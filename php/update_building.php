<?php
require_once __DIR__ . '/admin_guard_api.php';

header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['id'])) {
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
    exit;
}

$bldgId = (int)$data['id'];
$name   = trim($data['name']        ?? '');
$desc   = trim($data['description'] ?? '');
$floors = $data['floors'] ?? [];

if (!$bldgId || $name === '') {
    echo json_encode(["status" => "error", "message" => "Missing required fields"]);
    exit;
}

// ── Fetch old state, so we can compare it to the new state after saving ────
$oldName       = '';
$oldDesc       = '';
$oldFloorCount = 0;
$oldRoomCount  = 0;

$stmt = $conn->prepare("SELECT name, description FROM buildings WHERE id = ?");
$stmt->execute([$bldgId]);
$oldBuilding = $stmt->fetch();

if ($oldBuilding) {
    $oldName = $oldBuilding['name'];
    $oldDesc = $oldBuilding['description'] ?? '';
}

$stmt = $conn->prepare("SELECT COUNT(*) as total FROM floors WHERE building_id = ?");
$stmt->execute([$bldgId]);
$oldFloorCount = (int)$stmt->fetch()['total'];

$stmt = $conn->prepare("
    SELECT COUNT(*) as total FROM rooms r
    INNER JOIN floors f ON r.floor_id = f.id
    WHERE f.building_id = ?
");
$stmt->execute([$bldgId]);
$oldRoomCount = (int)$stmt->fetch()['total'];

try {
    $conn->beginTransaction();

    // 1. Update building basic info
    $stmt = $conn->prepare("UPDATE buildings SET name = ?, description = ? WHERE id = ?");
    $stmt->execute([$name, $desc, $bldgId]);

    // 2. Clear old floors (CASCADE deletes rooms automatically)
    $stmt = $conn->prepare("DELETE FROM floors WHERE building_id = ?");
    $stmt->execute([$bldgId]);

    // 3. Insert new floors and rooms (tracking counts as we go, for the log)
    $newFloorCount = 0;
    $newRoomCount  = 0;

    foreach ($floors as $f) {
        $level = (int)($f['level'] ?? 1);

        $stmt = $conn->prepare("INSERT INTO floors (building_id, floor_level) VALUES (?, ?)");
        $stmt->execute([$bldgId, $level]);
        $floorId = $conn->lastInsertId();
        $newFloorCount++;

        $rooms = $f['rooms'] ?? [];
        if (is_string($rooms)) {
            $rooms = array_filter(array_map('trim', explode(',', $rooms)));
        }

        foreach ($rooms as $roomName) {
            $roomName = trim((string)$roomName);
            if ($roomName !== '') {
                $stmt = $conn->prepare("INSERT INTO rooms (floor_id, room_name) VALUES (?, ?)");
                $stmt->execute([$floorId, $roomName]);
                $newRoomCount++;
            }
        }
    }

    $conn->commit();

    // ── Build a human-readable summary of what changed, and log it ─────────
    $changes = [];

    if ($oldName !== $name) {
        $changes[] = "Name changed from \"$oldName\" to \"$name\"";
    }
    if ($oldDesc !== $desc) {
        $changes[] = "Description updated";
    }
    if ($oldFloorCount !== $newFloorCount) {
        $diff = $newFloorCount - $oldFloorCount;
        $changes[] = $diff > 0
            ? "Added $diff floor(s) (now $newFloorCount total)"
            : "Removed " . abs($diff) . " floor(s) (now $newFloorCount total)";
    }
    if ($oldRoomCount !== $newRoomCount) {
        $diff = $newRoomCount - $oldRoomCount;
        $changes[] = $diff > 0
            ? "Added $diff room(s) (now $newRoomCount total)"
            : "Removed " . abs($diff) . " room(s) (now $newRoomCount total)";
    }

    if (!empty($changes)) {
        try {
            $logStmt = $conn->prepare("
                INSERT INTO activity_log
                    (actor_id, actor_name, action_type, target_type, target_id, target_label, details)
                VALUES (?, ?, 'building_updated', 'building', ?, ?, ?)
            ");
            $logStmt->execute([
                $_SESSION['user_id']  ?? 0,
                $_SESSION['username'] ?? 'Unknown',
                $bldgId,
                $name,
                implode('; ', $changes)
            ]);
        } catch (Exception $logError) {
            // If logging fails, we deliberately do NOT fail the whole request —
            // the actual building save already succeeded above.
        }
    }

    echo json_encode(["status" => "success"]);

} catch (Exception $e) {
    $conn->rollBack();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>