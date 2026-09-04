<?php

require_once __DIR__ . "/auth_guard.php";

// User is logged in.
// Now verify their role.
if (
    !isset($_SESSION["role"]) ||
    (
        $_SESSION["role"] !== "admin" &&
        $_SESSION["role"] !== "superadmin"
    )
) {
    header("Location: ../index.php");
    exit();
}