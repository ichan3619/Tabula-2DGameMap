<?php
// =============================================
//  achievements_helper.php
//  Shared function for unlocking an achievement
//  and awarding its XP bonus, used by any
//  endpoint that can trigger progress.
// =============================================

function checkAndUnlockAchievement($conn, $userId, $key, array &$newlyUnlocked) {
    $ach = $conn->prepare("SELECT id, name, description, xp_reward FROM achievements WHERE `key` = ?");
    $ach->execute([$key]);
    $achievement = $ach->fetch();
    if (!$achievement) return;

    $check = $conn->prepare("SELECT 1 FROM player_achievements WHERE user_id = ? AND achievement_id = ?");
    $check->execute([$userId, $achievement['id']]);
    if ($check->fetch()) return;   // already unlocked

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
}

function levelFromXpPHP($totalXp) {
    $level = 1;
    while ($totalXp >= 50 * $level * $level) {
        $totalXp -= 50 * $level * $level;
        $level++;
    }
    return $level;
}

function isNightOwlHour() {
    $hour = (int)date('G');   // 0–23, server time
    return $hour >= 0 && $hour < 4;
}