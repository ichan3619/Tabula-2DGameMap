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
$npcId  = isset($_GET['npc_id']) ? (int)$_GET['npc_id'] : 0;

if (!$npcId) {
    echo json_encode(["status" => "error", "message" => "Missing npc_id"]);
    exit();
}

try {
    $stmt = $conn->prepare("SELECT cooldown_until FROM npc_cooldowns WHERE user_id = ? AND npc_id = ?");
    $stmt->execute([$userId, $npcId]);
    $row = $stmt->fetch();

    $available = true;
    if ($row && $row['cooldown_until'] !== null) {
        $available = strtotime($row['cooldown_until']) <= time();
    }

    echo json_encode([
        "status"    => "success",
        "available" => $available,
        "cooldown_until" => $row['cooldown_until'] ?? null
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to check availability"]);
}