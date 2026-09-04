<?php
require_once "php/auth_guard.php";
require_once "php/config/database.php";

// Check if this user has already completed setup
$stmt = $conn->prepare("SELECT username, avatar FROM users WHERE id = ?");
$stmt->execute([$_SESSION["user_id"]]);
$user = $stmt->fetch();

$isNewUser = empty($user["username"]);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tabula - Character Setup</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-image: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('assets/img/bg.webp');
            background-size: cover;
            background-position: center;
            font-family: 'Press Start 2P', cursive;
            color: white;
        }

        /* The Main Setup Container - Back to your original style */
        .setup-case {
            background: #c9822b;
            padding: 40px;
            border: 6px solid #5b2f07;
            box-shadow:
                10px 10px 0px #3a1c05,
                inset -6px -6px 0px #9b5d1a,
                inset 6px 6px 0px #e6a24a;
            width: 500px;
            
            /* This forces everything inside to align perfectly in the center */
            display: flex;
            flex-direction: column;
            align-items: center; 
        }

        h2 {
            font-size: 18px;
            margin-bottom: 30px;
            text-shadow: 4px 4px #3a1c05;
        }

        /* Centered Input Box */
        input[type="text"] {
            background: #3a1c05;
            border: 4px solid #ffffff;
            color: #ffffff;
            padding: 15px;
            font-family: 'Press Start 2P';
            font-size: 14px;
            width: 80%;
            margin-bottom: 30px;
            outline: none;
            text-align: center; /* Makes the typing start in the middle */
        }

        .avatar-grid {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-bottom: 30px;
        }

        /* BIGGER Character Frames */
        .pixel-frame {
            background: #9b5d1a;
            border: 4px solid #5b2f07;
            padding: 10px;
            width: 140px; /* Increased size */
            height: 140px; /* Increased size */
            cursor: pointer;
            transition: transform 0.1s;
            image-rendering: pixelated; 
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .pixel-frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .pixel-frame:hover {
            background: #e6a24a;
            transform: scale(1.05);
        }

        .pixel-frame.selected {
            background: rgba(255, 255, 255, 0.7); 
            border-color: #522603;
            box-shadow: 0 0 15px #361a02;
        }

        /* Centered Start Button at the bottom */
        .btn-start {
            font-family: 'Press Start 2P';
            font-size: 20px;
            color: white;
            padding: 15px 30px;
            border: 4px solid #5b2f07;
            background: #4caf50; 
            box-shadow:
                6px 6px 0px #1e3a20,
                inset -4px -4px 0px #388e3c,
                inset 4px 4px 0px #81c784;
            cursor: pointer;
            margin-top: 10px;
        }

        .btn-start:active {
            transform: translateY(4px);
            box-shadow: 2px 2px 0px #1e3a20;
        }

        /* Back button - top-left, matches admin page styling */
        .btn-back {
            position: fixed;
            top: 20px;
            left: 20px;
            font-family: 'Press Start 2P', cursive;
            font-size: 10px;
            padding: 10px 15px;
            color: white;
            background: #fb5607;
            border: 3px solid #9e2a2b;
            cursor: pointer;
            box-shadow: 4px 4px 0px #000;
        }
        .btn-back:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px #000;
        }
    </style>
</head>
<body>

<button class="btn-back" id="backBtn" onclick="goBack()">← BACK</button>

<div class="setup-case">
    <h2 id="setupTitle">NEW VISITOR</h2>
    
    <input type="text" id="nickname" placeholder="NICKNAME..." maxlength="12">

    <div class="avatar-grid">
        <div class="pixel-frame" id="frameGirl" onclick="selectAvatar(this, 'girl.png')">
            <img src="assets/img/girl.png" alt="Girl">
        </div>
        <div class="pixel-frame" id="frameBoy" onclick="selectAvatar(this, 'boy.png')">
            <img src="assets/img/boy.png" alt="Boy">
        </div>
    </div>

    <button class="btn-start" onclick="saveAndEnter()">ENTER</button>
</div>

<script>
    let selectedAvatar = "";

    // Determined by PHP/database instead of localStorage
    const isNewUser = <?= $isNewUser ? 'true' : 'false' ?>;

    const existingName = localStorage.getItem("userName");
    const existingAvatar = localStorage.getItem("userAvatar");

    if (isNewUser) {

        document.getElementById("setupTitle").textContent =
            "WELCOME TO TABULA";

        document.getElementById("nickname").placeholder =
            "Enter your Username";

        document.querySelector(".btn-start").textContent =
            "EXPLORE!";

        // New players shouldn't go back yet
        document.getElementById("backBtn").style.display = "none";

    } else {

        document.getElementById("setupTitle").textContent =
            "CHANGE AVATAR";

        document.getElementById("nickname").value =
            existingName || "";

        document.querySelector(".btn-start").textContent =
            "SAVE";

        if (existingAvatar) {

            const frameId =
                existingAvatar === "boy.png"
                    ? "frameBoy"
                    : "frameGirl";

            const frame = document.getElementById(frameId);

            if (frame) {
                selectAvatar(frame, existingAvatar);
            }
        }
    }

    function goBack() {
        window.location.href = "menu.php";
    }

    function selectAvatar(element, fileName) {

        document.querySelectorAll(".pixel-frame").forEach(frame =>
            frame.classList.remove("selected")
        );

        element.classList.add("selected");
        selectedAvatar = fileName;
    }

    function saveAndEnter() {

        const name = document.getElementById("nickname").value.trim();
        const email = localStorage.getItem("userEmail");
        const role = localStorage.getItem("userRole") || "user";

        if (!name || !selectedAvatar) {
            alert("Choose a name and a character!");
            return;
        }

        fetch("php/save_setup.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                username: name,
                avatar: selectedAvatar,
                role: role
            })
        })
        .then(res => res.json())
        .then(data => {

            if (data.status === "success") {

                localStorage.setItem("userName", name);
                localStorage.setItem("userAvatar", selectedAvatar);

                window.location.href = "menu.php";

            } else {

                alert("Database Error: " + data.message);

            }

        });

    }
</script>

</body>
</html>