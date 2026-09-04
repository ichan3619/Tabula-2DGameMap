<?php

require_once __DIR__ . '/superadmin_guard.php';
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

$data = json_decode(file_get_contents("php://input"), true);

$id   = isset($data['id'])   ? (int)$data['id']   : null;
$role = isset($data['role']) ? trim($data['role']) : null;

$allowed_roles = ['user', 'admin', 'superadmin'];

if (!$id) {
    echo json_encode(["status" => "error", "message" => "Invalid user ID"]);
    exit();
}
if (!$role || !in_array($role, $allowed_roles)) {
    echo json_encode(["status" => "error", "message" => "Invalid role"]);
    exit();
}

try {
    // Grab the user's CURRENT info before we overwrite it, so we know what changed
    $stmt = $conn->prepare("SELECT email, username, role FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $target = $stmt->fetch();

    if (!$target) {
        echo json_encode(["status" => "error", "message" => "User not found"]);
        exit();
    }

    $oldRole = $target['role'];

    $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->execute([$role, $id]);

    // Only write a log entry if the role actually changed
    if ($oldRole !== $role) {
        try {
            $logStmt = $conn->prepare("
                INSERT INTO activity_log
                    (actor_id, actor_name, action_type, target_type, target_id, target_label, details)
                VALUES (?, ?, 'role_updated', 'user', ?, ?, ?)
            ");
            $logStmt->execute([
                $_SESSION['user_id']  ?? 0,
                $_SESSION['username'] ?? 'Unknown',
                $id,
                $target['username'] ?: $target['email'],
                "Role changed from \"$oldRole\" to \"$role\""
            ]);
        } catch (Exception $logError) {
            // If logging fails, don't fail the whole request
        }
    }

    echo json_encode(["status" => "success"]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to update role"]);
}