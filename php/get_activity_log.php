<?php
require_once __DIR__ . '/admin_guard_api.php';

header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

$role   = $_SESSION['role'];
$userId = $_SESSION['user_id'];

$sql    = "SELECT id, actor_id, actor_name, action_type, target_type, target_id, target_label, details, created_at
           FROM activity_log
           WHERE 1=1";
$params = [];

// ── Role-based restriction (the important security part) ───────────────────
// Regular admins ONLY ever see their own actions, no matter what filters are sent.
// Superadmins see everyone by default, but can optionally narrow to one actor.
if ($role !== 'superadmin') {
    $sql .= " AND actor_id = ?";
    $params[] = $userId;
} elseif (!empty($_GET['actor_id'])) {
    $sql .= " AND actor_id = ?";
    $params[] = (int)$_GET['actor_id'];
}

// ── Optional filter: action type ────────────────────────────────────────────
if (!empty($_GET['action_type'])) {
    $sql .= " AND action_type = ?";
    $params[] = $_GET['action_type'];
}

// ── Optional filter: date range ─────────────────────────────────────────────
if (!empty($_GET['date_from'])) {
    $sql .= " AND created_at >= ?";
    $params[] = $_GET['date_from'] . " 00:00:00";
}
if (!empty($_GET['date_to'])) {
    $sql .= " AND created_at <= ?";
    $params[] = $_GET['date_to'] . " 23:59:59";
}

$sql .= " ORDER BY created_at DESC LIMIT 500";

try {
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    echo json_encode(["status" => "success", "logs" => $logs]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to load activity log"]);
}
?>