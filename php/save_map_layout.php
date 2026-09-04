<?php
require_once __DIR__ . '/admin_guard_api.php';
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Invalid payload"]);
    exit();
}

$buildings = $data['buildings'] ?? [];
$waypoints = $data['waypoints'] ?? [];

try {
    $conn->beginTransaction();

    // ── Save building positions/sizes ───────────────────────────────────────
$stmt = $conn->prepare("
    UPDATE buildings
    SET map_x = ?, map_y = ?, width = ?, height = ?,
        zone_x = ?, zone_y = ?, zone_w = ?, zone_h = ?,
        col_x = ?, col_y = ?, col_w = ?, col_h = ?
    WHERE id = ?
");
foreach ($buildings as $b) {
    if (!isset($b['id'])) continue;
    $stmt->execute([
        (int)($b['x']      ?? 0),
        (int)($b['y']      ?? 0),
        (int)($b['width']  ?? 100),
        (int)($b['height'] ?? 100),
        (float)($b['zone_x'] ?? 0),
        (float)($b['zone_y'] ?? 0.4),
        (float)($b['zone_w'] ?? 1),
        (float)($b['zone_h'] ?? 0.6),
        (float)($b['col_x']  ?? 0.1),
        (float)($b['col_y']  ?? 0.6),
        (float)($b['col_w']  ?? 0.8),
        (float)($b['col_h']  ?? 0.2),
        (int)$b['id']
    ]);
}

    $conn->commit();

    // ── Save waypoints back to the JSON file ────────────────────────────────
    $waypointsPath = __DIR__ . '/../map/data/waypoints.json';

    // Basic shape validation so a bad payload can't corrupt the file
    $cleanWaypoints = [];
    foreach ($waypoints as $w) {
        if (!isset($w['id'], $w['x'], $w['y'])) continue;
        $cleanWaypoints[] = [
            "id"        => (string)$w['id'],
            "x"         => (int)$w['x'],
            "y"         => (int)$w['y'],
            "neighbors" => array_values(array_map('strval', $w['neighbors'] ?? []))
        ];
    }

    $json = json_encode($cleanWaypoints, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    if (file_put_contents($waypointsPath, $json) === false) {
        echo json_encode([
            "status"  => "error",
            "message" => "Buildings saved, but failed to write waypoints.json"
        ]);
        exit();
    }

    // ── Log it ───────────────────────────────────────────────────────────────
    try {
        $logStmt = $conn->prepare("
            INSERT INTO activity_log
                (actor_id, actor_name, action_type, target_type, target_id, target_label, details)
            VALUES (?, ?, 'map_layout_updated', 'map', 0, 'Map Layout', ?)
        ");
        $logStmt->execute([
            $_SESSION['user_id']  ?? 0,
            $_SESSION['username'] ?? 'Unknown',
            count($buildings) . " building(s) repositioned, " . count($cleanWaypoints) . " waypoint(s) saved"
        ]);
    } catch (Exception $e) {
        // Don't fail the save just because logging failed
    }

    echo json_encode(["status" => "success"]);

} catch (Exception $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}