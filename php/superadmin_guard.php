<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');


if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Not logged in"]);
    exit();
}

if (!isset($_SESSION["role"]) || $_SESSION["role"] !== "superadmin") {
    http_response_code(403); // Forbidden
    echo json_encode(["status" => "error", "message" => "Superadmin access required"]);
    exit();
}
