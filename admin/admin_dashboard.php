<?php
require_once "../php/admin_guard.php";
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    
    <title>Tabula - Admin Console</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    
    <script src="../assets/auth.js"></script>

    <style>
        body {
            margin: 0;
            background-color: #3a1c05;
            background-image: url("bg.png");
            background-size: cover;
            font-family: 'Arial', sans-serif;
            color: white;
            display: flex;
            justify-content: center;
            padding: 20px;
        }

        .dashboard-container {
            width: 1100px;
            background: #c9822b;
            border: 6px solid #5b2f07;
            padding: 40px;
            box-shadow: 10px 10px 0px #000;
            display: flex;
            flex-direction: column;
            gap: 30px;
            margin-top: 100px;
        }

        header {
            text-align: center;
            border-bottom: 4px solid #5b2f07;
            padding-bottom: 15px;
        }

        h1 {
            font-family: 'Press Start 2P', cursive;
            font-size: 22px;
            text-shadow: 3px 3px #5b2f07;
            margin: 10px 0;
        }

        .greeting {
            font-family: 'Press Start 2P', cursive;
            font-size: 12px;
            color: #5b2f07;
            margin-bottom: 5px;
        }

        .actions-panel {
            background: #5b2f07;
            padding: 25px;
            border: 4px solid #3a1c05;
        }

        .btn-group {
            display: flex;
            justify-content: center;
            gap: 20px;
        }

        .pixel-btn {
            font-family: 'Press Start 2P', cursive;
            font-size: 10px;
            padding: 15px 20px;
            background: #c9822b;
            color: white;
            border: 4px solid #3a1c05;
            cursor: pointer;
            box-shadow: 4px 4px 0px #000;
            transition: 0.1s;
        }

        .pixel-btn:hover {
            transform: translateY(2px);
            box-shadow: 2px 2px 0px #000;
            background: #e6a24a;
        }

        .btn-logout { background: #ae2012; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
        }

        .stat-card {
            background: #9b5d1a;
            border: 4px solid #5b2f07;
            padding: 25px;
            text-align: center;
            box-shadow: inset -4px -4px 0px #5b2f07;
        }

        .stat-label {
            font-family: 'Press Start 2P', cursive;
            font-size: 9px;
            margin-bottom: 15px;
            color: #ffd166;
            line-height: 1.4;
        }

        .stat-value {
            font-size: 40px;
            font-weight: bold;
            color: #ffffff;
        }

        .history-placeholder {
            border: 4px dashed #5b2f07;
            padding: 40px;
            text-align: center;
            color: #5b2f07;
            font-family: 'Press Start 2P', cursive;
            font-size: 14px;
        }
        
        .history-panel {
            background: #5b2f07;
            padding: 20px;
            border: 4px solid #3a1c05;
        }

        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .log-title {
            font-family: 'Press Start 2P', cursive;
            font-size: 13px;
            color: #ffd166;
            text-shadow: 2px 2px #1c0d00;
        }

        .log-actions {
            display: flex;
            gap: 10px;
        }

        .log-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            align-items: end;
            background: #3a1c05;
            padding: 14px;
            margin-bottom: 16px;
            border: 2px solid #1c0d00;
        }

        .log-filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .log-filter-group label {
            font-family: 'Press Start 2P', cursive;
            font-size: 8px;
            color: #ffd166;
        }

        .log-filter-group input,
        .log-filter-group select {
            font-family: Arial, sans-serif;
            font-size: 12px;
            padding: 8px;
            border: 2px solid #5b2f07;
            background: #c9822b;
            color: #3a1c05;
            font-weight: bold;
        }

        .log-filter-btn {
            padding: 10px 14px;
            font-size: 8px;
            height: fit-content;
        }

        .log-table-wrap {
            max-height: 400px;
            overflow-y: auto;
            border: 2px solid #3a1c05;
        }

        .log-table {
            width: 100%;
            border-collapse: collapse;
            background: #9b5d1a;
        }

        .log-table th {
            position: sticky;
            top: 0;
            background: #3a1c05;
            color: #ffd166;
            font-family: 'Press Start 2P', cursive;
            font-size: 8px;
            padding: 10px;
            text-align: left;
        }

        .log-table td {
            padding: 8px 10px;
            border-bottom: 2px solid #5b2f07;
            font-size: 12px;
            color: white;
            vertical-align: top;
        }

        .log-empty {
            text-align: center;
            font-family: 'Press Start 2P', cursive;
            font-size: 9px;
            color: #c9822b;
            padding: 20px;
        }

        .log-action-badge {
            display: inline-block;
            font-family: 'Press Start 2P', cursive;
            font-size: 7px;
            padding: 4px 8px;
            color: white;
            background: #4361ee;   /* fallback color for unknown/future action types */
            border: 2px solid #1d3557;
        }

        /* Building edits — blue */
        .log-action-badge.log-action-building_updated {
            background: #4361ee;
            border-color: #1d3557;
        }

        /* Role changes — purple */
        .log-action-badge.log-action-role_updated {
            background: #7c3aed;
            border-color: #4c1d95;
        }

        /* User deletions — red */
        .log-action-badge.log-action-user_deleted {
            background: #ae2012;
            border-color: #5b0000;
        }

        @media print {
            body * { visibility: hidden; }
            .history-panel, .history-panel * { visibility: visible; }
            .history-panel { position: absolute; top: 0; left: 0; width: 100%; }
            .log-actions, .log-filters button { display: none !important; }
        }
        
        
    </style>
</head>
<body>

<div class="dashboard-container">
    <header>
        <div class="greeting" id="adminGreet">WELCOME, USER</div>
        <h1>ADMIN DASHBOARD</h1>
    </header>

<div class="btn-group">
    <button class="pixel-btn" onclick="location.href='admin_mgmt.php'">USERS</button>
    <button class="pixel-btn" onclick="location.href='manage_buildings.php'">BUILDINGS</button>
    <?php if ($_SESSION['role'] === 'superadmin'): ?>
    <button class="pixel-btn" style="background:#4361ee;" onclick="location.href='edit_map.php'">EDIT MAP</button>
    <?php endif; ?>
    <button class="pixel-btn" onclick="location.href='../menu.php'">GAME MENU</button>
    <button class="pixel-btn btn-logout" onclick="logout()">LOGOUT</button>
</div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">TOTAL<br>USERS</div>
            <div class="stat-value" id="countUsers">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">TOTAL<br>ADMINS</div>
            <div class="stat-value" id="countAdmins">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">CAMPUS<br>BUILDINGS</div>
            <div class="stat-value" id="countBuildings">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">NEW<br>ENTRIES</div>
            <div class="stat-value" id="countNew">0</div>
        </div>
    </div>

<div class="history-panel" id="activityLogPanel" data-role="<?= htmlspecialchars($_SESSION['role']) ?>">
        <div class="log-header">
            <h3 class="log-title">ACTIVITY HISTORY LOG</h3>
            <div class="log-actions">
                <button class="pixel-btn" onclick="printActivityLog()">🖨 PRINT</button>
                <button class="pixel-btn" onclick="exportActivityLogCSV()">⬇ EXPORT CSV</button>
            </div>
        </div>

        <div class="log-filters">
            <div class="log-filter-group">
                <label>FROM</label>
                <input type="date" id="logDateFrom">
            </div>
            <div class="log-filter-group">
                <label>TO</label>
                <input type="date" id="logDateTo">
            </div>
            <div class="log-filter-group">
                <label>ACTION </label>
                <select id="logActionType">
                    <option value="">ALL ACTIONS</option>
                    <option value="building_updated">BUILDING UPDATED</option>
                    <option value="role_updated">ROLE UPDATED</option>
                    <option value="user_deleted">USER DELETED</option>
                </select>
            </div>
            <div class="log-filter-group" id="logUserFilterGroup" style="display:none;">
                <label>ADMIN</label>
                <select id="logActorFilter">
                    <option value="">ALL ADMINS</option>
                </select>
            </div>
            <button class="pixel-btn log-filter-btn" onclick="resetActivityLogFilters()">RESET FILTERS</button>
        </div>

        <div class="log-table-wrap">
            <table class="log-table" id="logTable">
                <thead>
                    <tr>
                        <th>DATE/TIME</th>
                        <th>ADMIN</th>
                        <th>ACTION</th>
                        <th>TARGET</th>
                        <th>DETAILS</th>
                    </tr>
                </thead>
                <tbody id="logTableBody">
                    <tr><td colspan="5" class="log-empty">LOADING...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    // 1. Setup greeting
    const adminName = localStorage.getItem("userName") || "ADMIN";
    document.getElementById('adminGreet').innerText = `WELCOME, ${adminName.toUpperCase()}`;

    // 2. Fetch stats
    fetch('get_admin_stats.php')
        .then(res => res.json())
        .then(data => {
            document.getElementById('countUsers').innerText = data.totalUsers;
            document.getElementById('countAdmins').innerText = data.totalAdmins;
            document.getElementById('countBuildings').innerText = data.totalBuildings;
            document.getElementById('countNew').innerText = data.newThisWeek;
        })
        .catch(err => console.log("Stats fetch failed."));
</script>
    
<script>
(function () {
    const panel = document.getElementById('activityLogPanel');
    const role  = panel.dataset.role;
    let currentLogs = [];

        const ACTION_LABELS = {
            building_updated: 'BUILDING UPDATED',
            role_updated:     'ROLE UPDATED',
            user_deleted:     'USER DELETED'
        };

    // Only superadmin gets the "filter by admin" dropdown
    if (role === 'superadmin') {
        document.getElementById('logUserFilterGroup').style.display = 'flex';

        fetch('../php/get_log_actors.php')
            .then(r => r.json())
            .then(data => {
                if (data.status !== 'success') return;
                const sel = document.getElementById('logActorFilter');
                data.actors.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.actor_id;
                    opt.textContent = a.actor_name || ('User #' + a.actor_id);
                    sel.appendChild(opt);
                });
            })
            .catch(() => {});
    }

    function loadActivityLog() {
        const params = new URLSearchParams();

        const dateFrom = document.getElementById('logDateFrom').value;
        const dateTo   = document.getElementById('logDateTo').value;
        const action   = document.getElementById('logActionType').value;

        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo)   params.set('date_to', dateTo);
        if (action)   params.set('action_type', action);

        if (role === 'superadmin') {
            const actor = document.getElementById('logActorFilter').value;
            if (actor) params.set('actor_id', actor);
        }

        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="log-empty">LOADING...</td></tr>';

        fetch('../php/get_activity_log.php?' + params.toString())
            .then(r => r.json())
            .then(data => {
                if (data.status !== 'success') {
                    tbody.innerHTML = '<tr><td colspan="5" class="log-empty">FAILED TO LOAD LOG</td></tr>';
                    return;
                }
                currentLogs = data.logs;
                renderLogTable(currentLogs);
            })
            .catch(() => {
                tbody.innerHTML = '<tr><td colspan="5" class="log-empty">NETWORK ERROR</td></tr>';
            });
    }
        function formatLogDate(dateStr) {
                const d = new Date(dateStr.replace(' ', 'T'));
                if (isNaN(d)) return dateStr;
                return d.toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: true
                });
            }
    function renderLogTable(logs) {
        const tbody = document.getElementById('logTableBody');

        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="log-empty">NO ACTIVITY FOUND</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const label = ACTION_LABELS[log.action_type] || log.action_type.toUpperCase();
            const when  = formatLogDate(log.created_at);

            return `
                <tr>
                    <td>${escLog(when)}</td>
                    <td>${escLog(log.actor_name || ('User #' + log.actor_id))}</td>
                    <td><span class="log-action-badge log-action-${escLog(log.action_type)}">${escLog(label)}</span></td>
                    <td>${escLog(log.target_label || (log.target_type + ' #' + log.target_id))}</td>
                    <td>${escLog(log.details || '')}</td>
                </tr>`;
        }).join('');
    }

    function resetActivityLogFilters() {
        document.getElementById('logDateFrom').value   = '';
        document.getElementById('logDateTo').value     = '';
        document.getElementById('logActionType').value = '';
        if (role === 'superadmin') {
            document.getElementById('logActorFilter').value = '';
        }
        loadActivityLog();
    }

    function printActivityLog() {
        window.print();
    }

    function exportActivityLogCSV() {
        if (!currentLogs.length) {
            alert('No log entries to export.');
            return;
        }

        const headers = ['Date/Time', 'Admin', 'Action', 'Target', 'Details'];
        const rows = currentLogs.map(log => [
            formatLogDate(log.created_at),
            log.actor_name || ('User #' + log.actor_id),
            ACTION_LABELS[log.action_type] || log.action_type,
            log.target_label || (log.target_type + ' #' + log.target_id),
            (log.details || '').replace(/\n/g, ' ')
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(csvEscape).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'activity_log_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function csvEscape(value) {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    function escLog(str) {
        return String(str ?? '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Expose functions so the onclick="" attributes in the HTML above can find them
    window.loadActivityLog         = loadActivityLog;
    window.resetActivityLogFilters = resetActivityLogFilters;
    window.printActivityLog        = printActivityLog;
    window.exportActivityLogCSV    = exportActivityLogCSV;

    // Auto-refresh the log whenever a filter value changes
    ['logDateFrom', 'logDateTo', 'logActionType'].forEach(id => {
        document.getElementById(id).addEventListener('change', loadActivityLog);
    });
    if (role === 'superadmin') {
        document.getElementById('logActorFilter').addEventListener('change', loadActivityLog);
    }
    
    // Load the log as soon as the page opens
    loadActivityLog();
})();
</script>
    
    

</body>
</html>
