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

$userId     = $_SESSION['user_id'];
$data       = json_decode(file_get_contents("php://input"), true);
$buildingId = isset($data['building_id']) ? (int)$data['building_id'] : 0;

if (!$buildingId) {
    echo json_encode(["status" => "error", "message" => "Missing building_id"]);
    exit();
}

try {
    $stmt = $conn->prepare("INSERT IGNORE INTO player_building_visits (user_id, building_id) VALUES (?, ?)");
    $stmt->execute([$userId, $buildingId]);
    $isNewVisit = $stmt->rowCount() > 0;

    $newlyUnlocked = [];

    if ($isNewVisit) {
        $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM player_building_visits WHERE user_id = ?");
        $countStmt->execute([$userId]);
        $visited = (int)$countStmt->fetch()['total'];

        $totalBuildings = (int)$conn->query("SELECT COUNT(*) as total FROM buildings")->fetch()['total'];

        if ($visited === 1)  checkAndUnlockAchievement($conn, $userId, 'first_building', $newlyUnlocked);
        if ($visited === 5)  checkAndUnlockAchievement($conn, $userId, 'explorer_5', $newlyUnlocked);
        if ($visited === 10) checkAndUnlockAchievement($conn, $userId, 'explorer_10', $newlyUnlocked);
        if ($totalBuildings > 0 && $visited === $totalBuildings) {
            checkAndUnlockAchievement($conn, $userId, 'explorer_all', $newlyUnlocked);
        }
        if (isNightOwlHour()) checkAndUnlockAchievement($conn, $userId, 'night_owl', $newlyUnlocked);
    }

    $totalStmt = $conn->prepare("SELECT total_xp FROM player_progress WHERE user_id = ?");
    $totalStmt->execute([$userId]);
    $totalXp = (int)($totalStmt->fetch()['total_xp'] ?? 0);

    echo json_encode([
        "status"         => "success",
        "new_visit"      => $isNewVisit,
        "total_xp"       => $totalXp,
        "newly_unlocked" => $newlyUnlocked
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}