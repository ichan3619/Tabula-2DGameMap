<?php
require_once __DIR__ . '/admin_guard_api.php';
header('Content-Type: application/json');

$path = __DIR__ . '/../map/data/waypoints.json';

if (!file_exists($path)) {
    echo json_encode(["status" => "error", "message" => "waypoints.json not found"]);
    exit();
}

$data = json_decode(file_get_contents($path), true);

if ($data === null) {
    echo json_encode(["status" => "error", "message" => "waypoints.json is invalid JSON"]);
    exit();
}

echo json_encode(["status" => "success", "waypoints" => $data]);