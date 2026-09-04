<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Not logged in"]);
    exit();
}

$userId = $_SESSION['user_id'];

try {
    $stmt = $conn->prepare("SELECT total_xp FROM player_progress WHERE user_id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $totalXp = $row ? (int)$row['total_xp'] : 0;

    // All achievements, with unlocked status + timestamp for this user
    $stmt = $conn->prepare("
        SELECT a.`key`, a.name, a.description, a.icon, a.xp_reward,
               pa.unlocked_at,
               (pa.user_id IS NOT NULL) AS unlocked
        FROM achievements a
        LEFT JOIN player_achievements pa
            ON pa.achievement_id = a.id AND pa.user_id = ?
        ORDER BY unlocked DESC, a.id ASC
    ");
    $stmt->execute([$userId]);
    $allAchievements = $stmt->fetchAll();

    // Keep the old "unlocked only" list too, for anything still using it
    $unlockedOnly = array_values(array_filter($allAchievements, fn($a) => (bool)$a['unlocked']));

    echo json_encode([
        "status"           => "success",
        "total_xp"         => $totalXp,
        "achievements"     => $unlockedOnly,      // backward-compatible
        "all_achievements" => $allAchievements    // new: full list with locked/unlocked
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to load progress"]);
}