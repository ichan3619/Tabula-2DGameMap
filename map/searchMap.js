// ================== DOM REFS (cached once) ==================
const searchInput     = document.getElementById('searchInput')
const searchBtn       = document.getElementById('searchBtn')
const searchContainer = document.querySelector('.search-container')
const infoPanel       = document.getElementById('infoPanel')
const roomPanel       = document.getElementById('roomPanel')
const roomList        = document.getElementById('roomList')

let navigationTarget = null   // shared with index.js
let lastSearchTerm   = ''     // remembers what was searched, so we can highlight the matching room

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
// ================== BUILDING INFO PANEL ==================
function showBuildingInfo(building) {
    infoPanel.innerHTML = `
        <h3>${building.name}</h3>
        <p>${building.description || 'No description available.'}</p>
        <button onclick="startNavigation('${building.name}')">Go To Building</button>
        <button onclick="closePreview()">Close</button>
        <div class="search-counter">${currentSearchIndex + 1} / ${searchResults.length}</div>
        ${searchResults.length > 1 ? `
        <div class="search-nav">
            <button onclick="prevSearchResult()">◀ Prev</button>
            <button onclick="nextSearchResult()">Next ▶</button>
        </div>` : ''}
    `
    infoPanel.style.display = 'block'

if (building.floors && building.floors.length > 0) {
        roomList.innerHTML = building.floors
            .slice()
            .sort((a, b) => a.level - b.level)
            .map(floor => `
                <div class="floor-section">
                    <div class="floor-header">FLOOR ${floor.level}</div>
                    ${
                        floor.rooms && floor.rooms.length > 0
                            ? floor.rooms.map(name => {
                                const isMatch = lastSearchTerm && name.toLowerCase().includes(lastSearchTerm)
                                return `<div class="room-item${isMatch ? ' room-item-highlight' : ''}">${escHtml(name)}</div>`
                              }).join('')
                            : `<div class="room-item">No rooms yet</div>`
                    }
                </div>`)
            .join('')
    } else {
        roomList.innerHTML = "<div class='room-item'>No rooms available</div>"
    }

    // Auto-scroll the room panel so the matched room is actually visible
    const highlighted = roomList.querySelector('.room-item-highlight')
    if (highlighted) {
        setTimeout(() => {
            highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
    }
    roomPanel.style.display = 'block'
}

// ================== FOCUS / PREVIEW ==================
function focusOnBuilding(target) {
    if (!target) return

    freezePlayer        = true
    highlightedBuilding = target

    if (state !== GameState.PREVIEW) {
        previewLock = { x: background.position.x, y: background.position.y }
    }

    const worldX = target.basePosition.x + (target.width  || target.image.width)  * scale / 2
    const worldY = target.basePosition.y + (target.height || target.image.height) * scale / 2

    state            = GameState.PREVIEW
    navigationTarget = null
    resetKeys()

    panTo(worldX, worldY, () => showBuildingInfo(target))
}

function closePreview() {
    freezePlayer        = false
    highlightedBuilding = null
    lastSearchTerm       = ''
    infoPanel.style.display = 'none'
    roomPanel.style.display = 'none'

    state = GameState.TRANSITION
    panToPlayer(() => { state = GameState.FREE })
}

// ================== SEARCH ==================
function handleSearch() {
    const value = searchInput.value.trim().toLowerCase()
    if (!value) return

    searchResults = buildings.filter(b => {
        const nameMatch = b.name && b.name.toLowerCase().includes(value)

        const roomMatch = b.floors && b.floors.some(floor =>
            floor.rooms && floor.rooms.some(room =>
                room.toLowerCase().includes(value)
            )
        )

        return nameMatch || roomMatch
    })

if (searchResults.length === 0) {
    lastSearchTerm = ''
    currentSearchIndex = 0

    infoPanel.style.display = 'block'
    roomPanel.style.display = 'none'

    infoPanel.innerHTML = `
        <h3>No Results Found</h3>
        <p>No matching buildings or rooms were found for "<strong>${escHtml(value)}</strong>".</p>
        <button onclick="infoPanel.style.display='none'">Close</button>
    `

    return
}

	lastSearchTerm      = value
    currentSearchIndex = 0
    focusOnCurrentSearchResult()

    searchContainer.classList.remove('active')
    searchInput.blur()
    searchInput.value = ''
}

function focusOnCurrentSearchResult() {
    const target = searchResults[currentSearchIndex]
    if (target) focusOnBuilding(target)
}

function nextSearchResult() {
    if (searchResults.length <= 1) return
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length
    focusOnCurrentSearchResult()
}

function prevSearchResult() {
    if (searchResults.length <= 1) return
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length
    focusOnCurrentSearchResult()
}

// ================== SEARCH BAR TOGGLE ==================
searchBtn.addEventListener('click', () => {
    if (!searchContainer.classList.contains('active')) {
        searchContainer.classList.add('active')
        searchInput.focus()
    } else {
        handleSearch()
    }
})

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  handleSearch()
    if (e.key === 'Escape') {
        searchContainer.classList.remove('active')
        searchInput.blur()
    }
})

searchInput.addEventListener('focus', () => {
    state        = GameState.SEARCH
    freezePlayer = true     // prevent movement while typing
    resetKeys()
})

searchInput.addEventListener('blur', () => {
    if (state === GameState.SEARCH) {
        state        = GameState.FREE
        freezePlayer = false
    }
    // Delay so a click on searchBtn registers before the bar closes
    setTimeout(() => {
        if (!searchInput.value) searchContainer.classList.remove('active')
    }, 150)
})

// ================== NAVIGATION ==================
function startNavigation(buildingName) {
    const target = buildings.find(b =>
        b.name && b.name.toLowerCase().includes(buildingName.toLowerCase())
    )
    if (!target || !pathFinder) return

    const playerWorldX = player.position.x - background.position.x + player.width  / 2
    const playerWorldY = player.position.y - background.position.y + player.height / 2

    const startNode = pathFinder.getClosestNode(playerWorldX, playerWorldY)

    // Use the building's collision box center instead of its raw top-left position,
    // so the target waypoint matches the same rectangle checkArrival() uses.
    const bWidth  = (target.width  || target.image.width)  * scale
    const bHeight = (target.height || target.image.height) * scale
    const col     = target.collision || { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }
    const collisionCenterX = target.basePosition.x + bWidth  * (col.x + col.width  / 2)
    const collisionCenterY = target.basePosition.y + bHeight * (col.y + col.height / 2)

    const endNode = pathFinder.getClosestNode(collisionCenterX, collisionCenterY)
    currentPath   = pathFinder.findPath(startNode, endNode)

    freezePlayer            = false
    highlightedBuilding     = null
    infoPanel.style.display = 'none'
    roomPanel.style.display = 'none'

    state = GameState.TRANSITION

    // panToPlayer redirects any running pan (including the preview pan)
    panToPlayer(() => {
        navigationTarget = target
        state            = GameState.NAVIGATE
        showCancelRouteButton()
    })
}

function showCancelRouteButton() {
    const btn = document.getElementById('cancelRouteBtn')
    if (btn) btn.style.display = 'block'
}

function hideCancelRouteButton() {
    const btn = document.getElementById('cancelRouteBtn')
    if (btn) btn.style.display = 'none'
}

function cancelNavigation() {
    currentPath      = []
    navigationTarget = null
    state            = GameState.FREE
    hideCancelRouteButton()
}

document.getElementById('cancelRouteBtn').addEventListener('click', cancelNavigation)

function drawNavigationArrow() {
    if (!navigationTarget || state !== GameState.NAVIGATE) return
	
    if (isPlayerTouchingBuildingCollision(player, navigationTarget)) {
    currentPath = []
    invalidatePath()

    navigationTarget = null
    state = GameState.FREE

    hideCancelRouteButton()
    return
}
    
    let targetWorldX, targetWorldY

    if (currentPath && currentPath.length > 0) {
        // Still have waypoints left — aim for the next node in the path
        targetWorldX = currentPath[0].x
        targetWorldY = currentPath[0].y
    } else {
        // Path exhausted — aim straight at the building itself
        targetWorldX = navigationTarget.basePosition.x + (navigationTarget.width  || navigationTarget.image.width)  * scale / 2
        targetWorldY = navigationTarget.basePosition.y + (navigationTarget.height || navigationTarget.image.height) * scale / 2
    }

    const screenX = targetWorldX + background.position.x
    const screenY = targetWorldY + background.position.y
    const playerX = player.position.x + player.width  / 2
    const playerY = player.position.y + player.height / 2

    const dx = screenX - playerX
    const dy = screenY - playerY
    if (Math.sqrt(dx * dx + dy * dy) < 30) return

    const angle  = Math.atan2(dy, dx)
    const pulse  = Math.sin(Date.now() / 200) * 5
    const arrowX = playerX + Math.cos(angle) * (60 + pulse)
    const arrowY = playerY + Math.sin(angle) * (60 + pulse)

    c.save()
    c.translate(arrowX, arrowY)
    c.rotate(angle)
    c.beginPath()
    c.moveTo(10,   0)
    c.lineTo(-10, -10)
    c.lineTo(-5,   0)
    c.lineTo(-10,  10)
    c.closePath()
    c.fillStyle   = '#f1c40f'
    c.shadowBlur  = 10
    c.shadowColor = 'black'
    c.fill()
    c.restore()
}

function isPlayerTouchingBuildingCollision(player, building) {
    const width  = (building.width  || building.image.width)  * scale
    const height = (building.height || building.image.height) * scale
    const col    = building.collision || { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }
    const left   = building.position.x + width  * col.x
    const right  = left + width  * col.width
    const top    = building.position.y + height * col.y
    const bottom = top  + height * col.height

    const px1 = player.position.x
    const px2 = player.position.x + player.width
    const py1 = player.position.y
    const py2 = player.position.y + player.height

    return px1 < right && px2 > left && py1 < bottom && py2 > top
}

function checkArrival() {
    if (!navigationTarget || state !== GameState.NAVIGATE) return
    if (isPlayerTouchingBuildingCollision(player, navigationTarget)) {
        navigationTarget = null
        state            = GameState.FREE
        hideCancelRouteButton()
    }
}

// ================== LEGACY WRAPPER ==================
// Keeps any external calls to returnCameraToPlayer() working
function returnCameraToPlayer(callback = null) {
    panToPlayer(callback)
}