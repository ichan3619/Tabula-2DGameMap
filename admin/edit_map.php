<?php
require_once "../php/admin_guard.php";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tabula - Map Editor</title>
    <script src="../assets/auth.js"></script>
    <style>
        *, *::before, *::after { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #111;
            font-family: Arial, sans-serif;
        }

        #toolbar {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 56px;
            background: #1a0e05;
            border-bottom: 3px solid #5b2f07;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 16px;
            z-index: 100;
        }

        #toolbar button {
            padding: 8px 14px;
            font-weight: bold;
            cursor: pointer;
            border: 2px solid #000;
            border-radius: 4px;
            color: #fff;
            background: #5b2f07;
        }

        .mode-btn.active {
            outline: 3px solid #f1c40f;
        }

        #hint {
            color: #ffd166;
            font-size: 12px;
        }

        #zoomLabel {
            color: #fff;
            min-width: 45px;
            text-align: center;
            display: inline-block;
        }

        #btnSave { background: #4caf50; }
        #btnBack { background: #fb5607; }

        #viewport {
            position: absolute;
            top: 56px; left: 0; right: 0; bottom: 0;
            overflow: auto;
            cursor: grab;
        }

        #mapCanvasWrap {
            position: relative;
            transform-origin: 0 0;
            width: fit-content;
        }

        #mapImage {
            display: block;
            user-select: none;
            pointer-events: none;
        }

        /* Building boxes (Step 5) */
        .bldg-box {
            position: absolute;
            border: 2px solid rgba(241, 196, 15, 0.8);
            background: rgba(0, 0, 0, 0.15);
            cursor: move;
            overflow: hidden;
        }
        .bldg-box.selected {
            border-color: #4caf50;
            background: rgba(76, 175, 80, 0.15);
        }
        .resize-handle {
            position: absolute;
            width: 14px;
            height: 14px;
            right: -7px;
            bottom: -7px;
            background: #4caf50;
            border: 2px solid #000;
            cursor: nwse-resize;
        }
        
        .zone-resize-handle {
            position: absolute;
            width: 14px; height: 14px;
            right: -7px; bottom: -7px;
            background: #0096ff;
            border: 2px solid #000;
            cursor: nwse-resize;
        }
        .collision-resize-handle {
            position: absolute;
            width: 14px; height: 14px;
            right: -7px; bottom: -7px;
            background: #ff0000;
            border: 2px solid #000;
            cursor: nwse-resize;
        }
        
        .bldg-label {
            position: absolute;
            top: -22px;
            left: 0;
            font-size: 11px;
            color: #f1c40f;
            background: rgba(0,0,0,0.7);
            padding: 2px 6px;
            white-space: nowrap;
            font-family: 'Courier New', monospace;
        }

        /* Waypoints (Step 6) */
        .wp-dot {
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #00ffff;
            border: 2px solid #003333;
            cursor: pointer;
            transform: translate(-50%, -50%);
        }
        .wp-dot.selected {
            background: #ff4444;
        }
        .wp-dot.inside-building {
            box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.5);
        }
        .wp-line {
            position: absolute;
            height: 2px;
            background: #00ffff;
            transform-origin: 0 0;
            pointer-events: none;
        }
        
        .layer-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}
.layer-toggle input {
    cursor: pointer;
}

/* Zone / collision overlays */
.zone-box {
    position: absolute;
    border: 2px dashed rgba(0, 150, 255, 0.9);
    background: rgba(0, 150, 255, 0.15);
    pointer-events: none;
}
.collision-box {
    position: absolute;
    border: 2px solid rgba(255, 0, 0, 0.9);
    background: rgba(255, 0, 0, 0.25);
    pointer-events: none;
}
    </style>
</head>
<body>

<div id="toolbar">
    <button class="mode-btn active" id="btnBuildingMode">🏢 BUILDINGS</button>
    <button class="mode-btn" id="btnWaypointMode">📍 WAYPOINTS</button>
    <button class="mode-btn" id="btnZoneMode">🔵 EDIT ZONE</button>
    <button class="mode-btn" id="btnCollisionMode">🔴 EDIT COLLISION</button>
    <select id="buildingSelect" style="padding:8px; font-weight:bold;">
        <option value="">-- Select Building --</option>
    </select>
    <button id="btnDeleteWP" style="background:#ae2012; display:none;">🗑 DELETE SELECTED</button>
    <span style="flex:1"></span>
    <span id="hint"></span>
    <span style="flex:1"></span>

    <label class="layer-toggle"><input type="checkbox" id="toggleBuildings" checked> 🏢</label>
    <label class="layer-toggle"><input type="checkbox" id="toggleZone" checked> 🔵 Zone</label>
    <label class="layer-toggle"><input type="checkbox" id="toggleCollision" checked> 🔴 Collision</label>
    <label class="layer-toggle"><input type="checkbox" id="toggleWaypoints" checked> 📍 Waypoints</label>

    <button id="zoomOut">−</button>
    <span id="zoomLabel">100%</span>
    <button id="zoomIn">+</button>
    <button id="btnSave">💾 SAVE ALL</button>
    <button id="btnBack" onclick="location.href='admin_dashboard.php'">← BACK</button>
</div>

<div id="viewport">
    <div id="mapCanvasWrap">
        <img id="mapImage" src="../map/img/Map.webp">
        <div id="buildingLayer"></div>
        <div id="waypointLayer"></div>
    </div>
</div>

    
<script src="../map/buildingRect.js"></script>
<script>
    // ── State ────────────────────────────────────────────────────────────
    let buildings = []
    let waypoints = []
    let mode = 'building'   // 'building' | 'waypoint'
    let zoom = 1
    const scale = 2

    let showZone      = true
    let showCollision = true

    let selectedWaypointId = null
    let draggingWP = null

    let draggingBuilding = null
    let resizingBuilding = null
    let dragStartClientX = 0
    let dragStartClientY = 0
    let dragOrigX = 0
    let dragOrigY = 0
    let resizeOrigW = 0
    let resizeOrigH = 0
    let selectedBuildingId = null
    let draggingRect = null    // { building, type: 'zone' | 'collision' }
    let resizingRect = null
    let rectOrig = null

    // ── DOM refs ─────────────────────────────────────────────────────────
    const wrap      = document.getElementById('mapCanvasWrap')
    const bldgLayer = document.getElementById('buildingLayer')
    const wpLayer   = document.getElementById('waypointLayer')
    const hint      = document.getElementById('hint')

    const mapImageEl = document.getElementById('mapImage')
mapImageEl.addEventListener('load', () => {
    console.log('Map natural size:', mapImageEl.naturalWidth, 'x', mapImageEl.naturalHeight)
    console.log('Map displayed size:', mapImageEl.offsetWidth, 'x', mapImageEl.offsetHeight)
})
    // ── Load data ────────────────────────────────────────────────────────
    fetch('../php/api_buildings.php')
        .then(r => r.json())
        .then(data => {
            buildings = data.map(b => ({ ...b }))
            renderBuildings()
        document.getElementById('buildingSelect').innerHTML =
        '<option value="">-- Select Building --</option>' +
        buildings.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('')
        })
        .catch(() => hint.textContent = 'Failed to load buildings')

    fetch('../php/get_waypoints.php')
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                waypoints = data.waypoints.map(w => ({ ...w, neighbors: [...(w.neighbors || [])] }))
                renderWaypoints()
            }
        })
        .catch(() => hint.textContent = 'Failed to load waypoints')

    // ── Render: buildings ────────────────────────────────────────────────
function renderBuildings() {
    bldgLayer.innerHTML = ''
    buildings.forEach(b => {
        const isRectMode = (mode === 'zone' || mode === 'collision')
        if (isRectMode && b.id !== selectedBuildingId) return   // hide everything else while adjusting

        const box = document.createElement('div')
        box.className = 'bldg-box' + (b.id === selectedBuildingId ? ' selected' : '')
        const rect = getBuildingRect(b)
        box.style.left   = rect.x + 'px'
        box.style.top    = rect.y + 'px'
        box.style.width  = rect.w + 'px'
        box.style.height = rect.h + 'px'
        box.style.zIndex = (b.id === selectedBuildingId) ? 50 : 1
        box.dataset.id = b.id

        const frames = b.frames || 1
        const imgHtml = b.image
            ? `<img class="bldg-img" src="../map/${b.image}"
                    style="position:absolute; top:0; left:0;
                           width:${frames * 100}%; height:100%;
                           object-fit:fill; pointer-events:none;
                           image-rendering:pixelated; opacity:0.25;">`
            : ''

        const zoneInteractive = mode === 'zone' && b.id === selectedBuildingId
        const zone = b.zone || { x: 0, y: 0.4, width: 1, height: 0.6 }
        const zoneHtml = showZone ? `
            <div class="zone-box" style="
                left:${zone.x * 100}%; top:${zone.y * 100}%;
                width:${zone.width * 100}%; height:${zone.height * 100}%;
                pointer-events:${zoneInteractive ? 'auto' : 'none'};
                cursor:${zoneInteractive ? 'move' : 'default'};">
                ${zoneInteractive ? '<div class="zone-resize-handle"></div>' : ''}
            </div>` : ''

        const colInteractive = mode === 'collision' && b.id === selectedBuildingId
        const col = b.collision || { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }
        const colHtml = showCollision ? `
            <div class="collision-box" style="
                left:${col.x * 100}%; top:${col.y * 100}%;
                width:${col.width * 100}%; height:${col.height * 100}%;
                pointer-events:${colInteractive ? 'auto' : 'none'};
                cursor:${colInteractive ? 'move' : 'default'};">
                ${colInteractive ? '<div class="collision-resize-handle"></div>' : ''}
            </div>` : ''

        box.innerHTML = `
            ${imgHtml}
            ${zoneHtml}
            ${colHtml}
            <div class="bldg-label">${escHtml(b.name)}</div>
            ${mode === 'building' ? `<div class="resize-handle" data-id="${b.id}"></div>` : ''}
        `

        box.addEventListener('mousedown', e => {
            if (mode !== 'building') return
            e.stopPropagation()
            if (e.target.classList.contains('resize-handle')) {
                resizingBuilding = b
                resizeOrigW = b.width
                resizeOrigH = b.height
            } else {
                draggingBuilding = b
                dragOrigX = b.x
                dragOrigY = b.y
            }
            dragStartClientX = e.clientX
            dragStartClientY = e.clientY
        })

        if (zoneInteractive) {
            box.querySelector('.zone-box').addEventListener('mousedown', e => {
                e.stopPropagation()
                b.zone = b.zone || { x: 0, y: 0.4, width: 1, height: 0.6 }
                rectOrig = { ...b.zone }
                if (e.target.classList.contains('zone-resize-handle')) {
                    resizingRect = { building: b, type: 'zone' }
                } else {
                    draggingRect = { building: b, type: 'zone' }
                }
                dragStartClientX = e.clientX
                dragStartClientY = e.clientY
            })
        }

        if (colInteractive) {
            box.querySelector('.collision-box').addEventListener('mousedown', e => {
                e.stopPropagation()
                b.collision = b.collision || { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }
                rectOrig = { ...b.collision }
                if (e.target.classList.contains('collision-resize-handle')) {
                    resizingRect = { building: b, type: 'collision' }
                } else {
                    draggingRect = { building: b, type: 'collision' }
                }
                dragStartClientX = e.clientX
                dragStartClientY = e.clientY
            })
        }

        bldgLayer.appendChild(box)
    })
}

    // ── Render: waypoints ────────────────────────────────────────────────
    function renderWaypoints() {
        wpLayer.innerHTML = ''

        waypoints.forEach(wp => {
            (wp.neighbors || []).forEach(nid => {
                const n = waypoints.find(w => w.id === nid)
                if (!n) return
                if (wp.id > nid) return

                const dx  = n.x - wp.x
                const dy  = n.y - wp.y
                const len = Math.hypot(dx, dy)

                const line = document.createElement('div')
                line.className = 'wp-line'
                line.style.left  = wp.x + 'px'
                line.style.top   = wp.y + 'px'
                line.style.width = len + 'px'
                line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
                wpLayer.appendChild(line)
            })
        })

        waypoints.forEach(wp => {
            const dot = document.createElement('div')
            dot.className = 'wp-dot' + (wp.id === selectedWaypointId ? ' selected' : '')
            if (isInsideAnyBuilding(wp)) dot.classList.add('inside-building')
            dot.style.left = wp.x + 'px'
            dot.style.top  = wp.y + 'px'
            dot.title = wp.id

            dot.addEventListener('mousedown', e => {
                if (mode !== 'waypoint') return
                e.stopPropagation()
                draggingWP = wp
            })

            dot.addEventListener('click', e => {
                if (mode !== 'waypoint') return
                e.stopPropagation()
                handleWaypointClick(wp)
            })

            wpLayer.appendChild(dot)
        })
    }

    function handleWaypointClick(wp) {
        if (!selectedWaypointId) {
            selectedWaypointId = wp.id
        } else if (selectedWaypointId === wp.id) {
            selectedWaypointId = null
        } else {
            toggleConnection(selectedWaypointId, wp.id)
            selectedWaypointId = null
        }
        renderWaypoints()
        updateDeleteBtnVisibility()
    }

    function toggleConnection(idA, idB) {
        const a = waypoints.find(w => w.id === idA)
        const b = waypoints.find(w => w.id === idB)
        if (!a || !b) return
        a.neighbors = a.neighbors || []
        b.neighbors = b.neighbors || []

        if (a.neighbors.includes(idB)) {
            a.neighbors = a.neighbors.filter(id => id !== idB)
            b.neighbors = b.neighbors.filter(id => id !== idA)
        } else {
            a.neighbors.push(idB)
            b.neighbors.push(idA)
        }
    }

    function isInsideAnyBuilding(wp) {
        return buildings.some(b => {
            const col = b.collision || { x: 0, y: 0.6, width: 1, height: 0.2 }
            const left   = b.x + b.width  * col.x   
            const right  = left + b.width  * col.width
            const top    = b.y + b.height * col.y
            const bottom = top + b.height * col.height
            return wp.x >= left && wp.x <= right && wp.y >= top && wp.y <= bottom
        })
    }
    
    document.getElementById('buildingSelect').addEventListener('change', e => {
    selectedBuildingId = e.target.value ? parseInt(e.target.value) : null
    renderBuildings()
})

    // ── Mouse tracking: drag/resize buildings, drag waypoints ────────────
    window.addEventListener('mousemove', e => {
        if (draggingBuilding) {
            const dx = (e.clientX - dragStartClientX) / zoom
            const dy = (e.clientY - dragStartClientY) / zoom
            draggingBuilding.x = Math.round(dragOrigX + dx)
            draggingBuilding.y = Math.round(dragOrigY + dy)
            renderBuildings()
        }
        if (resizingBuilding) {
            const dx = (e.clientX - dragStartClientX) / zoom / scale
            const dy = (e.clientY - dragStartClientY) / zoom / scale
            resizingBuilding.width  = Math.max(20, Math.round(resizeOrigW + dx))
            resizingBuilding.height = Math.max(20, Math.round(resizeOrigH + dy))
            renderBuildings()
        }
        if (draggingWP) {
            const rect = wrap.getBoundingClientRect()
            draggingWP.x = Math.round((e.clientX - rect.left) / zoom)
            draggingWP.y = Math.round((e.clientY - rect.top)  / zoom)
            renderWaypoints()
        }
        if (draggingRect) {
        const b = draggingRect.building
        const type = draggingRect.type
        const rectPxW = b.width  * scale
        const rectPxH = b.height * scale
        const dxFrac = ((e.clientX - dragStartClientX) / zoom) / rectPxW
        const dyFrac = ((e.clientY - dragStartClientY) / zoom) / rectPxH
        b[type].x = clamp(rectOrig.x + dxFrac, 0, 1 - b[type].width)
        b[type].y = clamp(rectOrig.y + dyFrac, 0, 1 - b[type].height)
        renderBuildings()
    }

    if (resizingRect) {
        const b = resizingRect.building
        const type = resizingRect.type
        const rectPxW = b.width  * scale
        const rectPxH = b.height * scale
        const dwFrac = ((e.clientX - dragStartClientX) / zoom) / rectPxW
        const dhFrac = ((e.clientY - dragStartClientY) / zoom) / rectPxH
        b[type].width  = clamp(rectOrig.width  + dwFrac, 0.02, 1 - b[type].x)
        b[type].height = clamp(rectOrig.height + dhFrac, 0.02, 1 - b[type].y)
        renderBuildings()
    }
    })

    window.addEventListener('mouseup', () => {
        draggingBuilding = null
        resizingBuilding = null
        draggingWP = null
        draggingRect = null     
    	resizingRect = null     
    })

    // ── Click empty map space (waypoint mode only) → add a new node ──────
    wrap.addEventListener('click', e => {
        if (mode !== 'waypoint') return
        if (e.target.id !== 'mapImage' && e.target !== wrap) return

        const rect = wrap.getBoundingClientRect()
        const x = Math.round((e.clientX - rect.left) / zoom)
        const y = Math.round((e.clientY - rect.top)  / zoom)

        const id = 'wp_' + Date.now()
        waypoints.push({ id, x, y, neighbors: [] })
        renderWaypoints()
    })

    // ── Delete selected waypoint ─────────────────────────────────────────
    function deleteSelectedWaypoint() {
        if (!selectedWaypointId) {
            alert('Click a waypoint dot first to select it, then delete.')
            return
        }
        waypoints = waypoints.filter(w => w.id !== selectedWaypointId)
        waypoints.forEach(w => {
            w.neighbors = (w.neighbors || []).filter(id => id !== selectedWaypointId)
        })
        selectedWaypointId = null
        renderWaypoints()
        updateDeleteBtnVisibility()
    }
    document.getElementById('btnDeleteWP').onclick = deleteSelectedWaypoint

    window.addEventListener('keydown', e => {
        if (mode !== 'waypoint') return
        if (e.key !== 'Delete' && e.key !== 'Backspace') return
        e.preventDefault()
        deleteSelectedWaypoint()
    })

    function updateDeleteBtnVisibility() {
        document.getElementById('btnDeleteWP').style.display = mode === 'waypoint' ? 'inline-block' : 'none'
    }

    // ── Mode switching ───────────────────────────────────────────────────
    document.getElementById('btnBuildingMode').onclick = () => setMode('building')
    document.getElementById('btnWaypointMode').onclick = () => setMode('waypoint')

function setMode(m) {
    mode = m
    document.getElementById('btnBuildingMode').classList.toggle('active', m === 'building')
    document.getElementById('btnWaypointMode').classList.toggle('active', m === 'waypoint')
    document.getElementById('btnZoneMode').classList.toggle('active', m === 'zone')
    document.getElementById('btnCollisionMode').classList.toggle('active', m === 'collision')

    bldgLayer.style.pointerEvents = (m === 'building' || m === 'zone' || m === 'collision') ? 'auto' : 'none'
    wpLayer.style.pointerEvents   = m === 'waypoint' ? 'auto' : 'none'

    selectedWaypointId = null
    renderWaypoints()
    renderBuildings()
    updateDeleteBtnVisibility()

    if (m === 'building')   hint.textContent = 'Drag a building to move it · Drag the green corner handle to resize'
    if (m === 'waypoint')   hint.textContent = 'Click a waypoint to select it, click another to connect/disconnect, or use DELETE SELECTED to remove it'
    if (m === 'zone')       hint.textContent = 'Select a building from the dropdown, then drag the blue box to move it, or its handle to resize'
    if (m === 'collision')  hint.textContent = 'Select a building from the dropdown, then drag the red box to move it, or its handle to resize'
}

document.getElementById('btnZoneMode').onclick = () => setMode('zone')
document.getElementById('btnCollisionMode').onclick = () => setMode('collision')

    // ── Layer toggles ────────────────────────────────────────────────────
    document.getElementById('toggleBuildings').addEventListener('change', e => {
        bldgLayer.style.display = e.target.checked ? 'block' : 'none'
    })
    document.getElementById('toggleZone').addEventListener('change', e => {
        showZone = e.target.checked
        renderBuildings()
    })
    document.getElementById('toggleCollision').addEventListener('change', e => {
        showCollision = e.target.checked
        renderBuildings()
    })
    document.getElementById('toggleWaypoints').addEventListener('change', e => {
        wpLayer.style.display = e.target.checked ? 'block' : 'none'
    })

    // ── Zoom ─────────────────────────────────────────────────────────────
    function applyZoom() {
        wrap.style.transform = `scale(${zoom})`
        document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%'
    }
    document.getElementById('zoomIn').onclick  = () => { zoom = Math.min(2, zoom + 0.1); applyZoom() }
    document.getElementById('zoomOut').onclick = () => { zoom = Math.max(0.1, zoom - 0.1); applyZoom() }

    // ── Save ─────────────────────────────────────────────────────────────
// ── Save ─────────────────────────────────────────────────────────────
document.getElementById('btnSave').onclick = () => {
    const payload = {
        buildings: buildings.map(b => {
            const zone = b.zone      || { x: 0,   y: 0.4, width: 1,   height: 0.6 }
            const col  = b.collision || { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }
            return {
                id: b.id,
                x: Math.round(b.x),
                y: Math.round(b.y),
                width: Math.round(b.width),
                height: Math.round(b.height),
                zone_x: zone.x,
                zone_y: zone.y,
                zone_w: zone.width,
                zone_h: zone.height,
                col_x: col.x,
                col_y: col.y,
                col_w: col.width,
                col_h: col.height
            }
        }),
        waypoints: waypoints.map(w => ({
            id: w.id,
            x: Math.round(w.x),
            y: Math.round(w.y),
            neighbors: w.neighbors || []
        }))
    }

    if (!confirm(`Save ${payload.buildings.length} building(s) and ${payload.waypoints.length} waypoint(s)? This will overwrite the live map data.`)) {
        return
    }

    fetch('../php/save_map_layout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => alert(data.status === 'success' ? 'Saved!' : 'Error: ' + data.message))
    .catch(() => alert('Network error while saving'))
}

    function escHtml(str) {
        const div = document.createElement('div')
        div.textContent = str || ''
        return div.innerHTML
    }
    
    function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val))
}

    // ── Initial mode ─────────────────────────────────────────────────────
    setMode('building')

</script>

</body>
</html>