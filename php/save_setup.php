<?php
session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/config/database.php';

// Read JSON request
$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request."
    ]);
    exit();
}

// Retrieve submitted data
$email  = trim($data->email ?? "");
$nick   = trim($data->username ?? "");
$role   = trim($data->role ?? "user");
$avatar = trim($data->avatar ?? "");

// Basic validation
if ($email === "" || $nick === "" || $avatar === "") {
    echo json_encode([
        "status" => "error",
        "message" => "Missing required fields."
    ]);
    exit();
}

try {

    $stmt = $conn->prepare("
        UPDATE users
        SET username = ?, role = ?, avatar = ?
        WHERE email = ?
    ");

    $stmt->execute([
        $nick,
        $role,
        $avatar,
        $email
    ]);

    // -----------------------------------------
    // Update the current PHP session
    // -----------------------------------------
    $_SESSION["username"] = $nick;
    $_SESSION["avatar"]   = $avatar;
    $_SESSION["role"]     = $role;
    $_SESSION["email"]    = $email;

    echo json_encode([
        "status" => "success"
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}