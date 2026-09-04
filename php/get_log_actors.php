<?php
require_once __DIR__ . '/superadmin_guard.php';

header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

try {
    $stmt = $conn->query("SELECT DISTINCT actor_id, actor_name FROM activity_log ORDER BY actor_name ASC");
    $actors = $stmt->fetchAll();

    echo json_encode(["status" => "success", "actors" => $actors]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to load actors"]);
}
?>