console.log('INDEX.JS FILE LOADED — TOP OF FILE')
const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

// ── Buffer pool: one buffer per building id — prevents same-size buildings sharing a canvas ──
const bufferPool = new Map()
function getBuffer(id, w, h) {
    if (w <= 0 || h <= 0) return null
    if (!bufferPool.has(id)) {
        const bc = document.createElement('canvas')
        bc.width  = w
        bc.height = h
        const bx = bc.getContext('2d')
        bx.imageSmoothingEnabled = false
        // dirty starts true so the first frame bakes the buffer
        bufferPool.set(id, { canvas: bc, ctx: bx, w, h, dirty: true })
    }
    const entry = bufferPool.get(id)
    // Resize (and mark dirty) if the building dimensions changed
    if (entry.w !== w || entry.h !== h) {
        entry.canvas.width  = w
        entry.canvas.height = h
        entry.w = w
        entry.h = h
        entry.dirty = true
    }
    return entry
}

let highlightedBuilding  = null
let searchResults        = []
let currentSearchIndex   = 0
let previewLock          = null
let currentPath          = []
const visitedBuildingIds = new Set()

canvas.width  = 1500
canvas.height = 750
const scale = 2
const DEBUG = false;

// ================== NPC CLICK / TAP TO TALK ==================
// Lets the player open an NPC's dialogue by clicking/tapping their sprite
// directly, instead of only via the proximity "TALK" button.
function getNPCAtPoint(px, py) {
    if (typeof npcs === 'undefined') return null
    // Iterate back-to-front so an NPC drawn on top (closer to camera) wins on overlap
    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i]
        if (!npc.image || !npc.image.complete || npc.image.naturalWidth === 0) continue
        const w = npc.image.naturalWidth  || 64
        const h = npc.image.naturalHeight || 64
        if (px >= npc.position.x && px <= npc.position.x + w &&
            py >= npc.position.y && py <= npc.position.y + h) {
            return npc
        }
    }
    return null
}

function canvasPointFromEvent(evt) {
    const rect   = canvas.getBoundingClientRect()
    const source = evt.changedTouches ? evt.changedTouches[0] : evt
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top)  * scaleY,
    }
}

function handleNPCClick(evt) {
    if (activeNPC) {
        // Dialogue already open — treat any canvas tap as "continue" too,
        // in case the panel's own buttons aren't reachable for some reason.
        evt.preventDefault()
        advanceDialogue()
        return
    }
    if (state !== GameState.FREE || freezePlayer) return
    const { x, y } = canvasPointFromEvent(evt)
    const npc = getNPCAtPoint(x, y)
    if (npc) {
        evt.preventDefault()
        startDialogue(npc)
    }
}

canvas.addEventListener('click', handleNPCClick)


const GameState = {
    FREE: 'free', PREVIEW: 'preview',
    NAVIGATE: 'navigate', SEARCH: 'search', TRANSITION: 'transition'
}
let state = GameState.FREE

const keys = { w:{pressed:false}, a:{pressed:false}, s:{pressed:false}, d:{pressed:false} }
let lastKey = null   // tracks the most recently pressed direction key
let freezePlayer = false
let gameStarted  = false

// ================== AVATAR ==================
const savedAvatar = localStorage.getItem('userAvatar') || 'girl.png'
const avatarBase  = savedAvatar === 'boy.png' ? 'newBoy' : 'newGirl'

// ================== IMAGES ==================
const bImage          = new Image(); bImage.src = './img/Map.webp'
const playerUpImage   = new Image(); playerUpImage.src   = `./img/${avatarBase}Back.png`
const playerDownImage = new Image(); playerDownImage.src = `./img/${avatarBase}Front.png`
const playerLeftImage = new Image(); playerLeftImage.src = `./img/${avatarBase}Left.png`
const playerRightImage= new Image(); playerRightImage.src= `./img/${avatarBase}Right.png`
const shadowImage     = new Image(); shadowImage.src     = './img/shadow.webp'

let cameraTarget  = null
let panCallback   = null   // fires once when the current pan finishes
let isPanning     = false
let playerAnchorX = 0      // player world X snapshotted before any preview pan
let playerAnchorY = 0      // player world Y snapshotted before any preview pan
let offset       = { x: 0, y: 0 }

// ================== SPRITES ==================
const background = new Sprite({ position: { x: 0, y: 0 }, image: bImage })

const player = new Sprite({
    position: { x: canvas.width / 2 - 250 / 4 / 2, y: canvas.height / 2 - 200 / 2 },
    image: playerUpImage,
    frame: { max: 4 },
    sprites: { up: playerUpImage, down: playerDownImage, left: playerLeftImage, right: playerRightImage }
})

const buildings  = []
const movables   = [background]
const boundaries = []

// ── Sorted render list: rebuilt only when something actually changes ──
let sortedRenderables = []
let renderListDirty   = true   // set true whenever player moves or buildings load

function markRenderDirty() { renderListDirty = true }

// ================== SHADOW ==================
function drawShadow() {
    if (!shadowImage.complete || !player.width) return
    const sw = player.width  * 0.8
    const sh = player.height * 0.4
    c.save()
    c.globalAlpha = 0.5
    c.drawImage(
        shadowImage,
        player.position.x + player.width / 2 - sw / 2,
        player.position.y + player.height - sh / 2 - 47,
        sw, sh
    )
    c.restore()
}

// ================== DETECTION ==================
function isPlayerInZone(player, building) {
    const width  = (building.width  || building.image.width)  * scale
    const height = (building.height || building.image.height) * scale
    const zone   = building.zone || { x: 0, y: 0.4, width: 1, height: 0.6 }
    const left   = building.position.x + width  * zone.x
    const right  = left + width  * zone.width
    const top    = building.position.y + height * zone.y
    const bottom = top  + height * zone.height
    const px = player.position.x + player.width  / 2
    const py = player.position.y + player.height - 10
    return px > left && px < right && py > top && py < bottom
}

// ================== LOAD BUILDINGS ==================
async function loadBuildings() {
    console.log('loadBuildings STARTED')   // TEMP DEBUG
    const res = await fetch('../php/api_buildings.php')
    if (!res.ok) { console.error('Failed to load buildings:', res.status); return }
    const data = await res.json()
    if (data.error) { console.error('API error:', data.error); return }
     console.log('loadBuildings got data:', data.length, 'buildings')   // TEMP DEBUG

    data.forEach(b => {
        const img = new Image()
        img.decoding = 'async'
        img.src = b.image

        const sprite = new Sprite({
            position: { x: b.x, y: b.y },
            image: img,
            frame: { max: b.frames || 1 }
        })

        sprite.basePosition = { x: b.x, y: b.y }
        sprite.zone         = b.zone      || { x: 0, y: 0.4, width: 1, height: 0.6 }
        sprite.collision    = b.collision || { x: 0, y: 0.6, width: 1, height: 0.4 }
        sprite.name         = b.name
        sprite.description  = b.description
        sprite.id           = b.id
        sprite.floors        = b.floors || []
        
        sprite.width        = b.width;
    	sprite.height       = b.height;
        console.log('SET', b.name, sprite.width, sprite.height)
        img.onload = null

        buildings.push(sprite)
        movables.push(sprite)
    })

    markRenderDirty()
}

async function loadBoundaries() {
    const res  = await fetch('data/boundaries.json')
    const data = await res.json()
    data.forEach(b => {
        const boundary = {
            position:     { x: b.x, y: b.y },
            width: b.width, height: b.height,
            basePosition: { x: b.x, y: b.y }
        }
        boundaries.push(boundary)
        movables.push(boundary)
    })
}

function initPlayerBadge() {
    const badge  = document.getElementById('playerBadge')
    const avatar = document.getElementById('badgeAvatar')
    if (!badge || !avatar) return

    const signedIn = isSignedIn()

    if (signedIn) {
        avatar.style.display = 'block'
        avatar.src = savedAvatar === 'boy.png'
            ? '../assets/img/boy.png'
            : '../assets/img/girl.png'

        const guestIcon = document.getElementById('badgeGuestIcon')
        if (guestIcon) guestIcon.remove()
    } else {
        avatar.style.display = 'none'

        if (!document.getElementById('badgeGuestIcon')) {
            const iconWrap = document.createElement('div')
            iconWrap.id = 'badgeGuestIcon'
            iconWrap.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            `
            badge.insertBefore(iconWrap, badge.firstChild)
        }
    }

const savedName = signedIn
    ? (localStorage.getItem('userName') || 'PLAYER')
    : 'GUEST'

    document.querySelector('.badge-name').textContent = savedName.toUpperCase()

    // ── Build the XP bar the first time only ──────────────────────────
    if (!document.getElementById('xpBarTrack')) {
        const badgeInfo = document.querySelector('.badge-info')
        const xpWrap = document.createElement('div')
        xpWrap.id = 'xpBarWrap'
        xpWrap.innerHTML = `<div id="xpBarTrack"><div id="xpBarFill"></div></div>`
        badgeInfo.appendChild(xpWrap)
    }

    refreshXpBar()

    badge.onclick = e => { e.stopPropagation(); toggleBadgeSettings() }
}

function showAchievementToast(achievement) {
    const toast = document.createElement('div')
    toast.className = 'achievement-toast'
    toast.innerHTML = `
        <div class="ach-toast-icon">🏆</div>
        <div class="ach-toast-body">
            <div class="ach-toast-title">Achievement Unlocked!</div>
            <div class="ach-toast-name">${escapeHtml(achievement.name)}</div>
        </div>
    `
    document.querySelector('.canvas-wrapper').appendChild(toast)

    requestAnimationFrame(() => toast.classList.add('show'))

    setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => toast.remove(), 400)
    }, 3500)
}

// ── Pulls current progress and updates the badge's level text + bar ──
async function refreshXpBar() {
    const sub = document.querySelector('.badge-sub')
    const fill = document.getElementById('xpBarFill')
    if (!sub || !fill) return

    try {
        const progress = await ProgressService.fetchProgress()
        const role = (localStorage.getItem('userRole') || 'user').toUpperCase()
        const label = isSignedIn() ? role : 'GUEST'

        sub.textContent = `${label} · LV.${progress.level}`

        const pct = progress.xpForNextLevel > 0
            ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100))
            : 0
        fill.style.width = pct + '%'
        fill.title = `${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP`
    } catch (e) {
        console.warn('Failed to load XP progress', e)
    }
}

// ================== SETTINGS MODAL ==================
const AUTH_KEYS = ['id', 'google_id', 'name', 'role', 'email', 'username', 'avatar']
let settingsOverlay = null

function isSignedIn() {
       return !!localStorage.getItem('userEmail')
   }

   function getStoredUser() {
       return {
           name:  localStorage.getItem('userName'),
           role:  localStorage.getItem('userRole'),
           email: localStorage.getItem('userEmail')
       }
   }

function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str || ''
    return div.innerHTML
}

function buildSettingsModal() {
    settingsOverlay = document.createElement('div')
    settingsOverlay.id = 'settingsOverlay'
    settingsOverlay.innerHTML = `
        <div id="settingsModal">
            <div id="settingsHeaderBar">
                <span>Settings</span>
                <button id="settingsCloseBtn" aria-label="Close">✕</button>
            </div>
            <div id="settingsAccountBody"></div>
        </div>
    `
    document.querySelector('.canvas-wrapper').appendChild(settingsOverlay)

    document.getElementById('settingsCloseBtn').addEventListener('click', closeSettingsModal)

    settingsOverlay.addEventListener('click', e => {
        if (e.target === settingsOverlay) closeSettingsModal()
    })

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeSettingsModal()
    })
}

async function renderSettingsModal() {
    if (!settingsOverlay) buildSettingsModal()
    const body = document.getElementById('settingsAccountBody')

    if (isSignedIn()) {
        const user = getStoredUser()
        const avatarSrc = document.getElementById('badgeAvatar')?.src || ''
        const role = (user.role || 'user').toUpperCase()

        const progress = await ProgressService.fetchProgress()

        const achievementsHtml = (progress.allAchievements || []).map(a => {
            const unlocked = !!a.unlocked
            return `
                <div class="ach-row ${unlocked ? 'ach-unlocked' : 'ach-locked'}">
                    <div class="ach-icon">${unlocked ? (a.icon || '🏆') : '🔒'}</div>
                    <div class="ach-info">
                        <div class="ach-name">${escapeHtml(a.name)}</div>
                        <div class="ach-desc">${escapeHtml(a.description || '')}</div>
                    </div>
                    ${unlocked ? `<div class="ach-check">✔</div>` : ''}
                </div>
            `
        }).join('')

        body.innerHTML = `
            <div class="modal-account-icon">
                <img src="${avatarSrc}" alt="avatar" style="width:56px;height:56px;border-radius:50%;border:2px solid #f1c40f;object-fit:cover;image-rendering:pixelated;">
            </div>
            <div class="modal-account-name">${escapeHtml(user.name) || 'PLAYER'}</div>
            <div class="modal-level-badge">LV. ${progress.level}</div>

            <div class="modal-stats-row">
                <div class="modal-stat">
                    <div class="modal-stat-value">${escapeHtml(role)}</div>
                    <div class="modal-stat-label">ROLE</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-value">${progress.totalXp}</div>
                    <div class="modal-stat-label">TOTAL XP</div>
                </div>
            </div>

            <div class="modal-achievements-section">
                <div class="modal-achievements-title">ACHIEVEMENTS</div>
                <div class="modal-achievements-list">
                    ${achievementsHtml || '<div class="ach-empty">No achievements yet.</div>'}
                </div>
            </div>

            <div class="modal-btn-group">
                <button class="modal-action-btn" id="settingsMenuBtn">← Back to Menu</button>
                <button class="modal-action-btn modal-action-btn-logout" id="settingsLogoutBtn">Log Out</button>
            </div>
        `
        document.getElementById('settingsMenuBtn').addEventListener('click', () => {
            window.location.href = '../menu.php'
        })
        document.getElementById('settingsLogoutBtn').addEventListener('click', handleLogout)

    } else {

        body.innerHTML = `
            <div class="modal-account-icon modal-account-icon-guest">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <div class="modal-account-name">Not Signed In</div>
            <div class="modal-account-role">GUEST</div>

            <div id="modalGoogleWrapper" style="position:relative;width:100%;height:48px;margin-top:8px;">
                <button class="modal-action-btn modal-action-btn-signin" style="position:absolute;inset:0;width:100%;height:100%;">
                    Sign In
                </button>
                <div id="modalGoogleBtnContainer" style="position:absolute;inset:0;opacity:0.01;overflow:hidden;cursor:pointer;"></div>
            </div>

            <button class="modal-action-btn" id="settingsMenuBtnGuest" style="margin-top:8px;">← Back to Menu</button>
        `
        document.getElementById('settingsMenuBtnGuest').addEventListener('click', () => {
            window.location.href = '../guest_menu.php'
        })
        renderModalGoogleButton()
    }
}

function toggleBadgeSettings() {
    if (!settingsOverlay) buildSettingsModal()
    const isOpen = settingsOverlay.style.display === 'flex'
    if (isOpen) {
        closeSettingsModal()
    } else {
        renderSettingsModal()
        settingsOverlay.style.display = 'flex'
        freezePlayer = true
        resetKeys()
    }
}

function closeSettingsModal() {
    if (settingsOverlay) settingsOverlay.style.display = 'none'
    freezePlayer = false
}


const GOOGLE_CLIENT_ID = "509785679401-9hlh0mcaft7miamq7j4pvl90pqqksun3.apps.googleusercontent.com"
let gisReady = false

function initGoogleAuthOnMap() {
    if (!window.google || !google.accounts || !google.accounts.id) {
        // Script tag is async/defer, so it may not be ready yet — retry shortly
        setTimeout(initGoogleAuthOnMap, 200)
        return
    }
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleMapCredentialResponse
    })
    gisReady = true
}
initGoogleAuthOnMap()

function renderModalGoogleButton() {
    if (!gisReady) {
        setTimeout(renderModalGoogleButton, 200)
        return
    }
    const container = document.getElementById('modalGoogleBtnContainer')
    const wrapper    = document.getElementById('modalGoogleWrapper')
    if (!container || !wrapper) return

    container.innerHTML = ''
    const width = wrapper.offsetWidth || 240

    google.accounts.id.renderButton(container, {
        theme: 'filled_blue',
        size: 'large',
        width: width,
        shape: 'rectangular'
    })
}

function handleMapCredentialResponse(response) {
    fetch('../php/auth_google.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'new_user') {
            localStorage.setItem('userEmail', data.email)
            localStorage.setItem('userRole', data.role || 'user')
            window.location.href = '../setup.php'
        } else if (data.status === 'login') {
            localStorage.setItem('userName', data.name)
            localStorage.setItem('userRole', data.role)
            localStorage.setItem('userEmail', data.email)
            localStorage.setItem('userAvatar', data.avatar)
            // Reload so the avatar sprite, badge, and role-gated UI all refresh
            window.location.reload()
        } else {
            console.warn('Google login failed:', data.message)
        }
    })
    .catch(() => console.warn('Network error during Google sign-in'))
}

function handleLogout() {
       localStorage.clear()
       if (window.google && google.accounts && google.accounts.id) {
           google.accounts.id.disableAutoSelect()
       }
       window.location.href = '../php/logout.php'
   }

// ================== COLLISION ==================
function willCollide(dx, dy) {
    const nextX = player.position.x + dx
    const nextY = player.position.y + dy
    const fw = player.width  * 0.4
    const fh = player.height * 0.3
    const fx = nextX + player.width  / 2 - fw / 2
    const fy = nextY + player.height - fh

    for (const b of buildings) {
        const col    = b.collision
        const width  = (b.width  || b.image.width)  * scale
        const height = (b.height || b.image.height) * scale
        const left   = b.position.x + width  * col.x
        const right  = left + width  * col.width
        const top    = b.position.y + height * col.y
        const bottom = top  + height * col.height
        if (fx < right && fx + fw > left && fy < bottom && fy + fh > top) return true
    }

    for (const boundary of boundaries) {
        const left   = boundary.position.x
        const right  = left + boundary.width
        const top    = boundary.position.y
        const bottom = top  + boundary.height
        if (fx < right && fx + fw > left && fy < bottom && fy + fh > top) return true
    }

    // NPCs block movement too (npcs array lives in npc.js, loaded alongside this file)
    if (typeof npcs !== 'undefined') {
        for (const npc of npcs) {
            if (!npc.image) continue
            const col    = npc.collision
            const width  = npc.image.naturalWidth  || 64
            const height = npc.image.naturalHeight || 64
            const left   = npc.position.x + width  * col.x
            const right  = left + width  * col.width
            const top    = npc.position.y + height * col.y
            const bottom = top  + height * col.height
            if (fx < right && fx + fw > left && fy < bottom && fy + fh > top) return true
        }
    }

    return false
}

// ================== MOVEMENT ==================
function moveWithCollision(moveX, moveY) {
    markRenderDirty() // keep front/behind draw order in sync as the player, buildings, and NPCs move relative to each other
    const steps  = Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)))
    const stepX  = moveX / steps
    const stepY  = moveY / steps
    const CENTER_TOLERANCE = 5
    const targetCenterX = canvas.width  / 2 - (player.width  / 2)
    const targetCenterY = canvas.height / 2 - (player.height / 2)
    const minX = canvas.width  - bImage.width
    const minY = canvas.height - bImage.height

    for (let i = 0; i < steps; i++) {
        if (stepY !== 0) {
            const nextMapY      = background.position.y - stepY
            const atMapLimitY   = nextMapY > 0 || nextMapY < minY
            const centerOffsetY = targetCenterY - player.position.y

            if (!atMapLimitY && Math.abs(centerOffsetY) < 15) {
                if (!willCollide(0, stepY)) movables.forEach(m => m.position.y -= stepY)
            } else {
                const nextPlayerY = player.position.y + stepY
                if (nextPlayerY >= 0 && nextPlayerY + player.height <= canvas.height)
                    if (!willCollide(0, stepY)) player.position.y += stepY
            }
        }

        if (stepX !== 0) {
            const nextMapX      = background.position.x - stepX
            const atMapLimitX   = nextMapX > 0 || nextMapX < minX
            const centerOffsetX = targetCenterX - player.position.x

            if (!atMapLimitX && Math.abs(centerOffsetX) < 15) {
                if (!willCollide(stepX, 0)) movables.forEach(m => m.position.x -= stepX)
            } else {
                const nextPlayerX = player.position.x + stepX
                if (nextPlayerX >= 0 && nextPlayerX + player.width <= canvas.width)
                    if (!willCollide(stepX, 0)) player.position.x += stepX
            }
        }
    }

    markRenderDirty()
}

// ================== WAYFINDER PATH ==================
let pathCanvas   = null
let pathValid    = false
let lastPathLen  = 0

function invalidatePath() { pathValid = false }

function rebakePath() {
    if (!currentPath || currentPath.length === 0) { pathCanvas = null; pathValid = true; return }

    if (!pathCanvas) {
        pathCanvas        = document.createElement('canvas')
        pathCanvas.width  = bImage.width
        pathCanvas.height = bImage.height
    }

    const pc = pathCanvas.getContext('2d')
    pc.clearRect(0, 0, pathCanvas.width, pathCanvas.height)

    pc.setLineDash([10, 15])
    pc.strokeStyle = 'rgba(0,255,255,0.8)'
    pc.lineWidth   = 6
    pc.lineCap     = 'round'
    pc.beginPath()

    const playerWorldX = player.position.x - background.position.x + player.width  / 2
    const playerWorldY = player.position.y - background.position.y + player.height / 2
    pc.moveTo(playerWorldX, playerWorldY)

    currentPath.forEach(node => pc.lineTo(node.x, node.y))
    pc.stroke()

    pathValid   = true
    lastPathLen = currentPath.length
}

function drawWayfinderPath() {
    if (state !== GameState.NAVIGATE || !currentPath || currentPath.length === 0) return

    if (!pathValid || currentPath.length !== lastPathLen) rebakePath()
    if (!pathCanvas) return

    c.save()
    c.translate(background.position.x, background.position.y)
    c.setLineDash([10, 15])
    c.lineDashOffset = -(Date.now() / 50) % 25
    c.strokeStyle     = 'rgba(0,255,255,0.8)'
    c.lineWidth       = 6
    c.lineCap         = 'round'
    c.beginPath()

    const playerWorldX = player.position.x - background.position.x + player.width  / 2
    const playerWorldY = player.position.y - background.position.y + player.height / 2
    c.moveTo(playerWorldX, playerWorldY)
    currentPath.forEach(node => c.lineTo(node.x, node.y))
    c.stroke()
    c.restore()

const ARRIVAL_RADIUS = 50
    const pwx = player.position.x - background.position.x + player.width  / 2
    const pwy = player.position.y - background.position.y + player.height / 2

    let closestIndex = -1
    let closestDist  = Infinity

    for (let i = 0; i < currentPath.length; i++) {
        const dist = Math.hypot(pwx - currentPath[i].x, pwy - currentPath[i].y)
        if (dist < ARRIVAL_RADIUS && dist < closestDist) {
            closestDist  = dist
            closestIndex = i
        }
    }

    if (closestIndex !== -1) {
        currentPath.splice(0, closestIndex + 1)
        invalidatePath()
    }
}

// ================== RENDER SORT (lazy) ==================
function rebuildRenderList() {
    sortedRenderables = []
    buildings.forEach(b => {
        const width  = (b.width  || b.image.width)  * scale
        const height = (b.height || b.image.height) * scale
        sortedRenderables.push({ type: 'building', ref: b, width, height })
    })
    if (typeof npcs !== 'undefined') {
        npcs.forEach(n => {
            const width  = (n.image && n.image.naturalWidth)  || 64
            const height = (n.image && n.image.naturalHeight) || 64
            sortedRenderables.push({ type: 'npc', ref: n, width, height })
        })
    }
    sortedRenderables.push({ type: 'player', ref: player, width: player.width, height: player.height })

    sortedRenderables.sort((a, b) => {
        const baseOf = (obj) => {
            if (obj.type === 'building') return obj.ref.position.y + (obj.height * (obj.ref.collision.y + obj.ref.collision.height))
            if (obj.type === 'npc')      return obj.ref.position.y + (obj.height * (obj.ref.collision.y + obj.ref.collision.height))
            return obj.ref.position.y + obj.height
        }
        return baseOf(a) - baseOf(b)
    })

    renderListDirty = false
}

// ================== ANIMATE ==================
let lastTimestamp = 0

function animate(timestamp = 0) {
    requestAnimationFrame(animate)

    const delta = Math.min(timestamp - lastTimestamp, 50)
    lastTimestamp = timestamp

    c.clearRect(0, 0, canvas.width, canvas.height)
    background.draw()

    if (DEBUG) {
        boundaries.forEach(b => {
            c.fillStyle = 'rgba(0,0,255,0.4)'
            c.fillRect(b.position.x, b.position.y, b.width, b.height)
        })
    }

    if (renderListDirty) rebuildRenderList()

    sortedRenderables.forEach(obj => {
        if (obj.type === 'building') {
            const b = obj.ref
            if (!b.image || !b.image.complete || b.image.naturalWidth === 0) return

            const rect = getBuildingRect({ ...b, x: b.position.x, y: b.position.y })
            const x = Math.round(rect.x)
            const y = Math.round(rect.y)
            const w = rect.w
            const h = rect.h
            if (w <= 0 || h <= 0) return

            const split = Math.round(h * 0.4)

            const isBehind      = isPlayerInZone(player, b)
            if (isBehind && !visitedBuildingIds.has(b.id)) {
    visitedBuildingIds.add(b.id)
ProgressService.logBuildingVisit(b.id).then(res => {
    if (res.status === 'success') {
        if (typeof refreshXpBar === 'function') { refreshXpBar() }
        const unlocked = res.newly_unlocked || []
        unlocked.forEach((ach, i) => {
            setTimeout(() => showAchievementToast(ach), i * 4000)
        })
    }
})
}
            const isHighlighted = b === highlightedBuilding

            const pooled = getBuffer(b.id, w, h)
            if (!pooled) return
            const { canvas: buf, ctx: bufCtx } = pooled

            // ── FIX: only re-bake when dirty or animation frame changed — not every tick ──
            const frameIndex = b.frame ? b.frame.val ?? 0 : 0
            if (pooled.dirty || pooled.lastFrame !== frameIndex) {
                bufCtx.clearRect(0, 0, w, h)
                bufCtx.drawImage(b.image, 0, 0,                    b.image.width, b.image.height * 0.4, 0,     0,     w, split + 1)
                bufCtx.drawImage(b.image, 0, b.image.height * 0.4, b.image.width, b.image.height * 0.6, 0, split, w, h - split)
                pooled.dirty     = false
                pooled.lastFrame = frameIndex
            }

            c.save()
            if (!isHighlighted && highlightedBuilding) c.globalAlpha = 0.4
            else if (isBehind) c.globalAlpha = 0.4

            if (isHighlighted) { c.shadowColor = 'yellow'; c.shadowBlur = 25 }

            c.drawImage(buf, x, y)

            if (DEBUG) {
                const col = b.collision
                c.globalAlpha = 0.4
                c.fillStyle   = 'red'
                c.fillRect(x + w * col.x, y + h * col.y, w * col.width, h * col.height)
            }
            c.restore()
        }

        if (obj.type === 'player') {
            drawShadow()
            obj.ref.draw()
        }

        if (obj.type === 'npc') {
            drawNPC(obj.ref)
        }
    })

    checkNPCProximity()

    if (isPanning && cameraTarget) {
        const speed         = 0.1
        const screenCenterX = canvas.width  / 2
        const screenCenterY = canvas.height / 2
        const minX          = canvas.width  - bImage.width
        const minY          = canvas.height - bImage.height

        const targetScreenX = cameraTarget.x + background.position.x
        const targetScreenY = cameraTarget.y + background.position.y
        const dx = (screenCenterX - targetScreenX) * speed
        const dy = (screenCenterY - targetScreenY) * speed

        const newBgX = Math.min(0, Math.max(minX, background.position.x + dx))
        const newBgY = Math.min(0, Math.max(minY, background.position.y + dy))
        const actualDx = newBgX - background.position.x
        const actualDy = newBgY - background.position.y

        movables.forEach(m => { m.position.x += actualDx; m.position.y += actualDy })
        player.position.x += actualDx
        player.position.y += actualDy

        const settled = Math.abs(actualDx) < 0.5 && Math.abs(actualDy) < 0.5

        if (settled) {
            isPanning    = false
            cameraTarget = null

            if (panCallback) {
                const cb = panCallback
                panCallback = null
                cb()
            }
        }

        markRenderDirty()
    }

    drawWayfinderPath()

    if (DEBUG) {
        c.save()
        c.fillStyle = 'rgba(0,0,0,0.6)'
        c.fillRect(10, 10, 240, 60)
        c.fillStyle = 'white'
        c.font      = 'bold 14px Arial'
        c.fillText(`Map X: ${Math.round(background.position.x)} (Limit: ${canvas.width - 2890})`, 20, 30)
        c.fillText(`Map Y: ${Math.round(background.position.y)} (Limit: ${canvas.height - 2352})`, 20, 50)
        c.restore()

        if (pathFinder) {

    // ==========================
    // Draw Connections
    // ==========================
    c.strokeStyle = "#00FFFF";
    c.lineWidth = 3;

    pathFinder.nodes.forEach(node => {

        node.neighbors.forEach(id => {

            const neighbor = pathFinder.nodeMap.get(id);

            if (!neighbor) return;

            c.beginPath();
            c.moveTo(
                node.x + background.position.x,
                node.y + background.position.y
            );
            c.lineTo(
                neighbor.x + background.position.x,
                neighbor.y + background.position.y
            );
            c.stroke();

        });

    });

    // ==========================
    // Draw Waypoints
    // ==========================
    pathFinder.nodes.forEach(node => {

        const x = node.x + background.position.x;
        const y = node.y + background.position.y;

        // Detection Radius
        c.beginPath();
        c.arc(x, y, 60, 0, Math.PI * 2);
        c.strokeStyle = "lime";
        c.lineWidth = 2;
        c.stroke();

        // Waypoint
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fillStyle = "red";
        c.fill();

        // Label
        c.fillStyle = "white";
        c.font = "bold 15px Arial";

        c.fillText(node.id, x + 10, y - 8);

        // Coordinates
        c.font = "11px Arial";
        c.fillStyle = "#00FFAA";
        c.fillText(
            `(${node.x}, ${node.y})`,
            x + 10,
            y + 8
        );

    });

}
    }

    if (!isPanning && state !== GameState.PREVIEW && state !== GameState.SEARCH) {
        if (typeof drawNavigationArrow === 'function') drawNavigationArrow()
        if (typeof checkArrival       === 'function') checkArrival()
    }

    if ((state !== GameState.FREE && state !== GameState.NAVIGATE) || freezePlayer) {
        player.moving = false
        return
    }

    const TARGET_FPS    = 60
    const speedPerFrame = 12
    const speedScale    = (delta / (1000 / TARGET_FPS))
    const speed         = speedPerFrame * Math.min(speedScale, 2)

    const activeKey = (lastKey && keys[lastKey]?.pressed)
        ? lastKey
        : (['w','a','s','d'].find(k => keys[k].pressed) ?? null)

    let moveX = 0, moveY = 0
    if (activeKey === 'w') moveY -= speed
    if (activeKey === 's') moveY += speed
    if (activeKey === 'a') moveX -= speed
    if (activeKey === 'd') moveX += speed

    player.moving = moveX !== 0 || moveY !== 0

    if (player.moving) {
        moveWithCollision(moveX, moveY)
        if      (activeKey === 'd') player.image = player.sprites.right
        else if (activeKey === 'a') player.image = player.sprites.left
        else if (activeKey === 's') player.image = player.sprites.down
        else if (activeKey === 'w') player.image = player.sprites.up
    }
}

// ================== RESIZE ==================
function resizeCanvas() {
    canvas.style.width  = '100%'
    canvas.style.height = '100%'
    if (gameStarted) {
        background.position.x = Math.max(canvas.width  - bImage.width,  Math.min(0, background.position.x))
        background.position.y = Math.max(canvas.height - bImage.height, Math.min(0, background.position.y))
    }
}
window.addEventListener('resize', resizeCanvas)

// ================== START ==================
function startGame() {
    if (gameStarted) return
    gameStarted = true

    player.position.x = canvas.width  / 2 - player.width  / 2
    player.position.y = canvas.height / 2 - player.height / 2

    const spawnPoint = { x: 200, y: bImage.height - 300 }
    const offsetX    = -(spawnPoint.x - canvas.width  / 2)
    const offsetY    = -(spawnPoint.y - canvas.height / 2)
    const minX = canvas.width  - bImage.width
    const minY = canvas.height - bImage.height

    background.position.x = Math.min(0, Math.max(minX, offsetX))
    background.position.y = Math.min(0, Math.max(minY, offsetY))

    buildings.forEach(b => {
        b.position.x = b.basePosition.x + background.position.x
        b.position.y = b.basePosition.y + background.position.y
    })
    boundaries.forEach(b => {
        b.position.x = b.basePosition.x + background.position.x
        b.position.y = b.basePosition.y + background.position.y
    })

    npcs.forEach(npc => {
        npc.position.x = npc.basePosition.x + background.position.x
        npc.position.y = npc.basePosition.y + background.position.y
    })

    markRenderDirty()
    animate()
    resizeCanvas()
    initPlayerBadge()
}

console.log(`Width: ${bImage.width}, Height: ${bImage.height}`)

async function loadWaypoints() {
    const res  = await fetch('data/waypoints.json')
    const data = await res.json()
    pathFinder = new PathFinder(data)
}

// ================== LOADING SCREEN ==================
let loadingOverlay = null
let loadingFill    = null
let loadingPct     = null

function buildLoadingOverlay() {
    loadingOverlay = document.createElement('div')
    loadingOverlay.id = 'loadingOverlay'
    loadingOverlay.innerHTML = `
        <div id="loadingBox">
            <div id="loadingTitle">Loading Map…</div>
            <div id="loadingBarTrack">
                <div id="loadingBarFill"></div>
            </div>
            <div id="loadingPct">0%</div>
        </div>
    `
    Object.assign(loadingOverlay.style, {
        position: 'absolute', inset: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a0e05', zIndex: '9999',
        transition: 'opacity 0.4s ease'
    })

    const box = loadingOverlay.querySelector('#loadingBox')
    Object.assign(box.style, {
        textAlign: 'center',
        fontFamily: "'Courier New', Courier, monospace",
        background: '#9b6a2f',
        border: '5px solid #3e2612',
        outline: '3px solid #000',
        outlineOffset: '-8px',
        borderRadius: '14px',
        boxShadow: '0 8px 0 #2a160b, 0 16px 40px rgba(0,0,0,0.5)',
        padding: '28px 32px'
    })

    const title = loadingOverlay.querySelector('#loadingTitle')
    Object.assign(title.style, {
        marginBottom: '16px', fontWeight: 'bold', letterSpacing: '1px',
        fontSize: '18px', color: '#fff8e6', textShadow: '2px 2px 0 #2a160b'
    })

    const track = loadingOverlay.querySelector('#loadingBarTrack')
    Object.assign(track.style, {
        width: '240px', height: '14px', borderRadius: '8px',
        background: 'rgba(0,0,0,0.35)', border: '2px solid #2b160b',
        overflow: 'hidden', margin: '0 auto'
    })

    loadingFill = loadingOverlay.querySelector('#loadingBarFill')
    Object.assign(loadingFill.style, {
        width: '0%', height: '100%', background: '#f1c40f',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)',
        transition: 'width 0.2s ease'
    })

    loadingPct = loadingOverlay.querySelector('#loadingPct')
    Object.assign(loadingPct.style, {
        marginTop: '12px', fontSize: '13px', fontWeight: 'bold',
        color: '#f1c40f', textShadow: '1px 1px 0 #2a160b'
    })

    document.querySelector('.canvas-wrapper').appendChild(loadingOverlay)
    canvas.style.visibility = 'hidden'
}

function updateLoadingProgress(done, total) {
    if (!loadingFill) return
    const pct = Math.round((done / total) * 100)
    loadingFill.style.width = pct + '%'
    loadingPct.textContent  = pct + '%'
}

function hideLoadingOverlay() {
    if (!loadingOverlay) return
    canvas.style.visibility = 'visible'
    loadingOverlay.style.opacity = '0'
    setTimeout(() => loadingOverlay?.remove(), 400)
}

function trackProgress(promises) {
    let done = 0
    const total = promises.length
    updateLoadingProgress(0, total)
    return promises.map(p => p.then(v => { done++; updateLoadingProgress(done, total); return v }))
}

async function init() {
    buildLoadingOverlay()

    const tasks = [
        new Promise(res => bImage.onload           = res),
        new Promise(res => playerUpImage.onload    = res),
        new Promise(res => playerDownImage.onload  = res),
        new Promise(res => playerLeftImage.onload  = res),
        new Promise(res => playerRightImage.onload = res),
        new Promise(res => shadowImage.onload      = res),
        loadBuildings(),
        loadBoundaries(),
        Promise.resolve(resizeCanvas()),
        loadWaypoints(),
        loadNPCs()
    ]

    await Promise.all(trackProgress(tasks))

    // Wait for every building's <img> to finish decoding too —
    // loadBuildings() only waits for the JSON, not the actual image files
    await Promise.all(buildings.map(b =>
        b.image.complete
            ? Promise.resolve()
            : new Promise(res => { b.image.onload = res; b.image.onerror = res })
    ))

    c.imageSmoothingEnabled = false
    player.width  = playerUpImage.width  / 4
    player.height = playerUpImage.height

    // Pre-bake all building buffers before revealing the canvas —
    // so the very first visible frame is fully composited
    buildings.forEach(b => {
        if (!b.image || !b.image.complete || b.image.naturalWidth === 0) return
        const w = Math.round((b.width  || b.image.width)  * scale)
        const h = Math.round((b.height || b.image.height) * scale)
        const pooled = getBuffer(b.id, w, h)
        if (!pooled) return
        const split = Math.round(h * 0.4)
        pooled.ctx.clearRect(0, 0, w, h)
        pooled.ctx.drawImage(b.image, 0, 0,                    b.image.width, b.image.height * 0.4, 0, 0,     w, split + 1)
        pooled.ctx.drawImage(b.image, 0, b.image.height * 0.4, b.image.width, b.image.height * 0.6, 0, split, w, h - split)
        pooled.dirty = false
    })

    startGame()
    hideLoadingOverlay()
}

init()

// ================== INPUT ==================
function resetKeys() {
    keys.w.pressed = keys.a.pressed = keys.s.pressed = keys.d.pressed = false
    lastKey = null
}

const mobileBtns = {
    w: document.getElementById('btn-w'),
    a: document.getElementById('btn-a'),
    s: document.getElementById('btn-s'),
    d: document.getElementById('btn-d')
}

Object.keys(mobileBtns).forEach(key => {
    const btn = mobileBtns[key]
    if (!btn) return
    btn.addEventListener('touchstart',  e => { e.preventDefault(); keys[key].pressed = true;  lastKey = key }, { passive: false })
    btn.addEventListener('touchend',    e => { e.preventDefault(); keys[key].pressed = false; if (lastKey === key) lastKey = ['w','a','s','d'].find(k => k !== key && keys[k].pressed) ?? null })
    btn.addEventListener('touchcancel', ()  => { keys[key].pressed = false; if (lastKey === key) lastKey = null })
})

window.addEventListener('keydown', e => {
    if (!keys[e.key]) return
    keys[e.key].pressed = true
    lastKey = e.key
})
window.addEventListener('keyup', e => {
    if (!keys[e.key]) return
    keys[e.key].pressed = false
    if (lastKey === e.key) lastKey = ['w','a','s','d'].find(k => k !== e.key && keys[k].pressed) ?? null
})
window.addEventListener('blur', () => resetKeys())

// ================== PAN HELPERS (used by searchMap.js) ==================

function panTo(worldX, worldY, callback = null) {
    cameraTarget = { x: worldX, y: worldY }
    isPanning    = true
    panCallback  = callback || null
}

function panToPlayer(callback = null) {
    const worldX = player.position.x - background.position.x + player.width  / 2
    const worldY = player.position.y - background.position.y + player.height / 2
    panTo(worldX, worldY, callback)
}