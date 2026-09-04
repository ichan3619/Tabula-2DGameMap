<?php
$path = __DIR__ . '/../map/data/waypoints.json';
$ok = is_writable($path) ? "WRITABLE ✅" : "NOT WRITABLE ❌";
echo "$path is $ok";