<?php
session_start();
session_regenerate_id(true);

header('Content-Type: application/json');

require_once __DIR__ . '/config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!$data || empty($data->credential)) {
    echo json_encode([
        "status" => "error",
        "message" => "No credential provided"
    ]);
    exit();
}

$token = $data->credential;
$CLIENT_ID = "509785679401-9hlh0mcaft7miamq7j4pvl90pqqksun3.apps.googleusercontent.com";

// Verify token with Google
$token_info = file_get_contents("https://oauth2.googleapis.com/tokeninfo?id_token=" . $token);
$token_data = json_decode($token_info, true);

if (!$token_data || $token_data['aud'] !== $CLIENT_ID) {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid Google Token"
    ]);
    exit();
}

$email     = $token_data['email'];
$name      = $token_data['name'];
$google_id = $token_data['sub'];

try {

    // Get ALL profile information
    $stmt = $conn->prepare("
        SELECT id,username, avatar, role, email
        FROM users
        WHERE email = ?
    ");

    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {

    if (empty($user['username'])) {

        $_SESSION["user_id"] = $user["id"];
        $_SESSION["username"] = "";
        $_SESSION["email"] = $user["email"];
        $_SESSION["role"] = $user["role"];
        $_SESSION["avatar"] = $user["avatar"];

        echo json_encode([
            "status" => "new_user",
            "email"  => $email,
            "role"   => $user["role"]
        ]);

    } else {

            $_SESSION["user_id"] = $user["id"];
            $_SESSION["username"] = $user["username"];
            $_SESSION["email"] = $user["email"];
            $_SESSION["role"] = $user["role"];
            $_SESSION["avatar"] = $user["avatar"];	
            
            echo json_encode([
                "status" => "login",
                "name"   => $user['username'],
                "avatar" => $user['avatar'],
                "email"  => $user['email'],
                "role"   => $user['role']
            ]);

        }

    } else {

        $default_role = "user";

        $ins = $conn->prepare("
            INSERT INTO users (google_id, name, email, role)
            VALUES (?, ?, ?, ?)
        ");

        	$ins->execute([
            $google_id,
            $name,
            $email,
            $default_role
        ]);

        $newUserId = $conn->lastInsertId();

        $_SESSION["user_id"] = $newUserId;
        $_SESSION["username"] = "";
        $_SESSION["email"] = $email;
        $_SESSION["role"] = $default_role;
        $_SESSION["avatar"] = "";

        echo json_encode([
            "status" => "new_user",
            "email"  => $email,
            "role"   => $default_role
        ]);
        
    }

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "status" => "error",
        "message" => "Database error"
    ]);
}