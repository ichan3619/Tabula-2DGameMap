<?php
session_start();

// Clear all session variables
$_SESSION = [];

// Delete the session cookie
if (isset($_COOKIE[session_name()])) {
    setcookie(
        session_name(),
        '',
        time() - 3600,
        '/'
    );
}

// Destroy the session
session_destroy();

// Start a fresh empty session
session_start();
session_regenerate_id(true);

// Destroy the new one too
$_SESSION = [];
session_destroy();

// Redirect
header("Location: ../index.html");
exit();