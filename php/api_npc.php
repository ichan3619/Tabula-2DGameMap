<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/config/database.php';

try {
    $stmt = $conn->prepare("SELECT * FROM npcs WHERE active = 1 ORDER BY id ASC");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $npcs = [];
    foreach ($rows as $row) {
        $npcs[] = [
            "id"          => (int)$row['id'],
            "name"        => $row['name'],
            "image"       => $row['image'],
            "x"           => (int)$row['map_x'],
            "y"           => (int)$row['map_y'],
            "width"       => (int)$row['width'],
            "height"      => (int)$row['height'],
            "zone_radius" => (int)$row['zone_radius'],
            "dialogue"    => json_decode($row['dialogue'], true) ?? []
        ];
    }

    echo json_encode($npcs, JSON_PRETTY_PRINT);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Query failed: " . $e->getMessage()]);
}
?>