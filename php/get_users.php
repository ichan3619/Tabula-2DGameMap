<?php
require_once __DIR__ . '/superadmin_guard.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../php/config/database.php';

try {
    $stmt = $conn->query("
        SELECT id, email, username, role, status
        FROM users
        ORDER BY
            FIELD(role, 'superadmin', 'admin', 'user'),
            email ASC
    ");

    $users = $stmt->fetchAll();

    echo json_encode([
        "status" => "success",
        "users"  => $users
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to fetch users"]);
}
?>