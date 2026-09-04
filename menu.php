<?php
require_once "php/auth_guard.php";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Tabula - Main Menu</title>

    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <script src="assets/auth.js"></script>

    <style>
        *, *::before, *::after { box-sizing: border-box; }

        body, html {
            margin: 0;
            padding: 0;
            height: 100vh;
            width: 100vw;
            overflow-x: hidden;
            overflow-y: auto;
            font-family: 'Press Start 2P', cursive;
            color: white;
            background:
                linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)),
                url('assets/img/bg.webp') no-repeat center center fixed;
            background-size: cover;
        }

        .viewport-wrapper{
            display:flex;
            justify-content:center;
            align-items:center;
            min-height:100vh;
            padding:20px 0;
        }

        .menu-card{
            background:#c9822b;
            border:6px solid #5b2f07;
            box-shadow:
                10px 10px 0px #3a1c05,
                inset -6px -6px 0px #9b5d1a,
                inset 6px 6px 0px #e6a24a;

            padding:50px 60px;
            display:flex;
            flex-direction:column;
            align-items:center;
            width:460px;
        }

        .menu-title{
            font-size:42px;
            text-shadow:4px 4px #3a1c05;
            margin:0 0 6px 0;
            letter-spacing:4px;
        }

        .welcome-label{
            font-size:9px;
            color:#ffd166;
            text-shadow:2px 2px #3a1c05;
            margin:0 0 40px 0;
            text-align:center;
            line-height:1.8;
        }

        .divider{
            width:100%;
            height:4px;
            background:#5b2f07;
            margin-bottom:36px;
            box-shadow:0 2px 0 #3a1c05;
        }

        .btn-group{
            display:flex;
            flex-direction:column;
            gap:14px;
            width:100%;
        }

        .pixel-btn{
            font-family:'Press Start 2P';
            font-size:11px;
            padding:16px 20px;
            color:white;
            border:4px solid #3a1c05;
            cursor:pointer;
            box-shadow:4px 4px 0px #000;
            width:100%;
            text-align:center;
            background:#9b5d1a;
        }

        .pixel-btn:hover{
            background:#e6a24a;
        }

        .btn-play{
            background:#4caf50;
            border-color:#1e3a20;
        }

        .btn-avatar{
            background:#9b5d1a;
            border-color:#3a1c05;
        }

        .btn-logout{
            background:#ae2012;
            border-color:#5b0000;
        }

        #rotate-overlay{
            display:none;
            position:fixed;
            inset:0;
            background:#000;
            z-index:9999;
            justify-content:center;
            align-items:center;
            flex-direction:column;
        }

        @media screen and (orientation:portrait){
            #rotate-overlay{
                display:flex;
            }

            .viewport-wrapper{
                display:none;
            }
        }

        @media screen and (max-height:600px) and (orientation:landscape){

            .menu-card{
                transform:scale(.7);
                margin:20px 0;
            }

            body,html{
                height:auto;
                min-height:100vh;
            }

        }

    </style>

</head>

<body>

<div id="rotate-overlay">
    <p style="color:#ffd166;font-size:10px;">
        PLEASE ROTATE TO LANDSCAPE
    </p>
</div>

<div class="viewport-wrapper">

    <div class="menu-card">

        <h1 class="menu-title">TABULA</h1>

        <p class="welcome-label">
            WELCOME BACK,<br>
            <span><?= htmlspecialchars(strtoupper($_SESSION["username"])) ?></span>
        </p>

        <div class="divider"></div>

        <div class="btn-group">

            <button
                class="pixel-btn btn-play"
                onclick="location.href='map/map.html'">
                ▶ EXPLORE CAMPUS
            </button>

            <button
                class="pixel-btn btn-avatar"
                onclick="location.href='setup.php'">
                ★ CHANGE AVATAR
            </button>

			<?php if ($_SESSION["role"] === "admin" || $_SESSION["role"] === "superadmin"): ?>
            <button
                class="pixel-btn"
                style="background:#4361ee;border-color:#1d3557;"
                onclick="location.href='admin/admin_dashboard.php'">
                ← ADMIN DASHBOARD
            </button>
            <?php endif; ?>
            
            <button
                class="pixel-btn btn-logout"
                onclick="logout()">
                ✕ LOGOUT
            </button>

        </div>

    </div>

</div>

<script>

if ('requestIdleCallback' in window){

    requestIdleCallback(()=>{
        const warm = new Image();
        warm.src='map/img/Map.webp';
    });

}else{

    setTimeout(()=>{
        const warm = new Image();
        warm.src='map/img/Map.webp';
    },200);

}

</script>

</body>
</html>