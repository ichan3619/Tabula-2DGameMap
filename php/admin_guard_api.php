<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');

// 1. Must be logged in at all
if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Not logged in"]);
    exit();
}

// 2. Must be admin or superadmin
if (!isset($_SESSION["role"]) || ($_SESSION["role"] !== "admin" && $_SESSION["role"] !== "superadmin")) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Admin access required"]);
    exit();
}
