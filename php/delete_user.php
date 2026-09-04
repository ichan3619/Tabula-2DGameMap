<?php

require_once __DIR__ . '/superadmin_guard.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../php/config/database.php';

$data = json_decode(file_get_contents("php://input"), true);
$id = isset($data['id']) ? (int)$data['id'] : null;

if (!$id) {
    echo json_encode(["status" => "error", "message" => "Invalid user ID"]);
    exit();
}

try {
    // Grab the user's info BEFORE deleting — once it's gone, we can't look it up anymore
    $stmt = $conn->prepare("SELECT email, username, role FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $target = $stmt->fetch();

    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["status" => "error", "message" => "User not found"]);
        exit();
    }

    if ($target) {
        try {
            $logStmt = $conn->prepare("
                INSERT INTO activity_log
                    (actor_id, actor_name, action_type, target_type, target_id, target_label, details)
                VALUES (?, ?, 'user_deleted', 'user', ?, ?, ?)
            ");
            $logStmt->execute([
                $_SESSION['user_id']  ?? 0,
                $_SESSION['username'] ?? 'Unknown',
                $id,
                $target['username'] ?: $target['email'],
                "Deleted user (" . ($target['role'] ?? 'unknown') . ") - " . $target['email']
            ]);
        } catch (Exception $logError) {
            // Don't fail the whole request just because logging failed
        }
    }

    echo json_encode(["status" => "success"]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to delete user"]);
}