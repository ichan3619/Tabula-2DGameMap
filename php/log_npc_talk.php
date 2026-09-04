<?php
if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/achievements_helper.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Not logged in"]);
    exit();
}

$userId = $_SESSION['user_id'];
$data   = json_decode(file_get_contents("php://input"), true);
$npcId  = isset($data['npc_id']) ? (int)$data['npc_id'] : 0;

if (!$npcId) {
    echo json_encode(["status" => "error", "message" => "Missing npc_id"]);
    exit();
}

try {
    $stmt = $conn->prepare("INSERT IGNORE INTO player_npc_talks (user_id, npc_id) VALUES (?, ?)");
    $stmt->execute([$userId, $npcId]);
    $isNewTalk = $stmt->rowCount() > 0;

    $newlyUnlocked = [];

    if ($isNewTalk) {
        $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM player_npc_talks WHERE user_id = ?");
        $countStmt->execute([$userId]);
        $talked = (int)$countStmt->fetch()['total'];

        $totalNpcs = (int)$conn->query("SELECT COUNT(*) as total FROM npcs WHERE active = 1")->fetch()['total'];

        if ($totalNpcs > 0 && $talked === $totalNpcs) {
            checkAndUnlockAchievement($conn, $userId, 'friendly_neighbor', $newlyUnlocked);
        }
        if (isNightOwlHour()) checkAndUnlockAchievement($conn, $userId, 'night_owl', $newlyUnlocked);
    }

    $totalStmt = $conn->prepare("SELECT total_xp FROM player_progress WHERE user_id = ?");
    $totalStmt->execute([$userId]);
    $totalXp = (int)($totalStmt->fetch()['total_xp'] ?? 0);

    echo json_encode([
        "status"         => "success",
        "new_talk"       => $isNewTalk,
        "total_xp"       => $totalXp,
        "newly_unlocked" => $newlyUnlocked
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}