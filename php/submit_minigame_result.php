<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');
require_once __DIR__ . '/achievements_helper.php';
require_once __DIR__ . '/config/database.php';

// Must be logged in — guests never reach this endpoint (handled client-side instead)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Not logged in"]);
    exit();
}

$userId = $_SESSION['user_id'];
$data   = json_decode(file_get_contents("php://input"), true);

$npcId    = isset($data['npc_id'])   ? (int)$data['npc_id']   : 0;
$gameKey  = isset($data['game_key']) ? trim($data['game_key']) : '';
$score    = isset($data['score'])    ? (int)$data['score']    : 0;

if (!$npcId || !$gameKey) {
    echo json_encode(["status" => "error", "message" => "Missing npc_id or game_key"]);
    exit();
}

// ── Cooldown length per game session (minutes) ──────────────────────────
const COOLDOWN_MINUTES = 15;

try {
    $conn->beginTransaction();

    // 1. Verify this NPC isn't already on cooldown for this player
    //    (prevents replay spam / calling this endpoint directly)
    $stmt = $conn->prepare("SELECT cooldown_until FROM npc_cooldowns WHERE user_id = ? AND npc_id = ?");
    $stmt->execute([$userId, $npcId]);
    $row = $stmt->fetch();

    if ($row && $row['cooldown_until'] !== null && strtotime($row['cooldown_until']) > time()) {
        $conn->rollBack();
        echo json_encode(["status" => "error", "message" => "This NPC is on cooldown"]);
        exit();
    }

    // 2. Award XP — calculated server-side from score, never trust client XP directly
    //    Simple formula: 1 XP per 2 score points, capped so huge scores can't be gamed
    $xpAwarded = min(100, (int)round($score / 2));

    $stmt = $conn->prepare("
        INSERT INTO player_progress (user_id, total_xp)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE total_xp = total_xp + VALUES(total_xp)
    ");
    $stmt->execute([$userId, $xpAwarded]);

    // 3. Set/refresh this NPC's cooldown for this player
    $stmt = $conn->prepare("
        INSERT INTO npc_cooldowns (user_id, npc_id, cooldown_until)
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
        ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until)
    ");
    $stmt->execute([$userId, $npcId, COOLDOWN_MINUTES]);

    // 4. Count total completed quests so far (for achievement checks)
    //    We track this via activity_log so we don't need a new counter table
    $logStmt = $conn->prepare("
        INSERT INTO activity_log
            (actor_id, actor_name, action_type, target_type, target_id, target_label, details)
        VALUES (?, ?, 'minigame_completed', 'npc', ?, ?, ?)
    ");
    $logStmt->execute([
        $userId,
        $_SESSION['username'] ?? 'Unknown',
        $npcId,
        $gameKey,
        "Score: $score, XP awarded: $xpAwarded"
    ]);

    $countStmt = $conn->prepare("
        SELECT COUNT(*) as total FROM activity_log
        WHERE actor_id = ? AND action_type = 'minigame_completed'
    ");
    $countStmt->execute([$userId]);
    $questCount = (int)$countStmt->fetch()['total'];

    // 5. Check achievement unlocks
    $newlyUnlocked = [];

    $checkAndUnlock = function ($key) use ($conn, $userId, &$newlyUnlocked) {
        $ach = $conn->prepare("SELECT id, name, description, xp_reward FROM achievements WHERE `key` = ?");
        $ach->execute([$key]);
        $achievement = $ach->fetch();
        if (!$achievement) return;

        // Skip if already unlocked
        $check = $conn->prepare("SELECT 1 FROM player_achievements WHERE user_id = ? AND achievement_id = ?");
        $check->execute([$userId, $achievement['id']]);
        if ($check->fetch()) return;

        $ins = $conn->prepare("INSERT INTO player_achievements (user_id, achievement_id) VALUES (?, ?)");
        $ins->execute([$userId, $achievement['id']]);

        if ($achievement['xp_reward'] > 0) {
            $bonus = $conn->prepare("UPDATE player_progress SET total_xp = total_xp + ? WHERE user_id = ?");
            $bonus->execute([$achievement['xp_reward'], $userId]);
        }

        $newlyUnlocked[] = [
            'key'         => $key,
            'name'        => $achievement['name'],
            'description' => $achievement['description'],
            'xp_reward'   => (int)$achievement['xp_reward']
        ];
    };

    if ($questCount === 1) $checkAndUnlock('first_quest');
    if ($questCount === 5) $checkAndUnlock('five_quests');
    // "Perfect score" threshold — adjust based on what a max score actually looks like per game
    if ($score >= 200) $checkAndUnlock('perfect_score');

    // ── Distinct-NPC quest achievements ─────────────────────────────────
    $distinctStmt = $conn->prepare("
        SELECT COUNT(DISTINCT npc_id) as total FROM npc_cooldowns WHERE user_id = ?
    ");
    $distinctStmt->execute([$userId]);
    $distinctNpcCount = (int)$distinctStmt->fetch()['total'];

    $totalNpcs = (int)$conn->query("SELECT COUNT(*) as total FROM npcs WHERE active = 1")->fetch()['total'];

    if ($distinctNpcCount === 5) $checkAndUnlock('helpful_student');
    if ($totalNpcs > 0 && $distinctNpcCount === $totalNpcs) $checkAndUnlock('campus_hero');

    // ── Speedrunner ──────────────────────────────────────────────────────
    if ($score >= 250) $checkAndUnlock('speedrunner');

    // ── Night Owl ────────────────────────────────────────────────────────
    if (isNightOwlHour()) $checkAndUnlock('night_owl');

    // ── Level milestones (check AFTER xp update above) ──────────────────
    $freshTotal = $conn->prepare("SELECT total_xp FROM player_progress WHERE user_id = ?");
    $freshTotal->execute([$userId]);
    $currentLevel = levelFromXpPHP((int)($freshTotal->fetch()['total_xp'] ?? 0));

    if ($currentLevel >= 5)  $checkAndUnlock('level_5');
    if ($currentLevel >= 10) $checkAndUnlock('level_10');
    
    
    $conn->commit();

    // 6. Return updated totals so the frontend can show XP bar / toasts
    $totalStmt = $conn->prepare("SELECT total_xp FROM player_progress WHERE user_id = ?");
    $totalStmt->execute([$userId]);
    $totalXp = (int)($totalStmt->fetch()['total_xp'] ?? 0);

    echo json_encode([
        "status"          => "success",
        "xp_awarded"       => $xpAwarded,
        "total_xp"         => $totalXp,
        "newly_unlocked"   => $newlyUnlocked,
        "cooldown_minutes" => COOLDOWN_MINUTES
    ]);

} catch (Exception $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}