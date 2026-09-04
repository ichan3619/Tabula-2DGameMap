// =============================================
//  minigame.js — Quest cutscene + mini-games
//  Games: Wire Repair (3 levels) & Memory Match (3 levels, 6 cards each)
//  Optimized for landscape mobile (short viewport height)
// =============================================

function offerQuest(npc) {
    dlgText.textContent = `Got a quick task for you, want to help out?`
    dlgNext.style.display  = 'none'
    dlgClose.style.display = 'none'

    const actions = dlgPanel.querySelector('.dlg-actions')

    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'dlg-btn mg-quest-btn'
    acceptBtn.textContent = '✔ Accept Quest'
    Object.assign(acceptBtn.style, {
        background:'#4caf50', border:'none', borderRadius:'6px',
        padding:'6px 14px', fontWeight:'bold', cursor:'pointer',
        fontFamily:'inherit', fontSize:'12px', color:'#fff'
    })

    const declineBtn = document.createElement('button')
    declineBtn.className = 'dlg-btn mg-quest-btn'
    declineBtn.textContent = '✕ Not Now'
    Object.assign(declineBtn.style, {
        background:'#555', border:'none', borderRadius:'6px',
        padding:'6px 14px', fontWeight:'bold', cursor:'pointer',
        fontFamily:'inherit', fontSize:'12px', color:'#fff'
    })

    acceptBtn.onclick = () => {
        acceptBtn.remove(); declineBtn.remove()
        dlgPanel.style.display = 'none'
        startQuestSequence(npc)
    }
    declineBtn.onclick = () => {
        acceptBtn.remove(); declineBtn.remove()
        cleanupQuestUI()
        endDialogue()
    }

    actions.appendChild(acceptBtn)
    actions.appendChild(declineBtn)
}

function cleanupQuestUI() {
    if (dlgNext)  dlgNext.style.display  = ''
    if (dlgClose) dlgClose.style.display = ''
    document.querySelectorAll('.mg-quest-btn').forEach(b => b.remove())
    questPending = false
}

// ── Fade overlay ─────────────────────────────────────────────
let questOverlay = null
function ensureOverlay() {
    if (questOverlay) return questOverlay
    questOverlay = document.createElement('div')
    questOverlay.id = 'questOverlay'
    Object.assign(questOverlay.style, {
        position:'absolute', inset:'0', background:'#000', opacity:'0',
        zIndex:'2000', pointerEvents:'none', transition:'opacity 0.5s ease'
    })
    document.querySelector('.canvas-wrapper').appendChild(questOverlay)
    return questOverlay
}
function fadeToBlack(cb) {
    const ov = ensureOverlay()
    ov.style.pointerEvents = 'auto'
    requestAnimationFrame(() => { ov.style.opacity = '1' })
    setTimeout(cb, 520)
}
function fadeFromBlack(cb) {
    const ov = ensureOverlay()
    requestAnimationFrame(() => { ov.style.opacity = '0' })
    setTimeout(() => { ov.style.pointerEvents = 'none'; cb && cb() }, 520)
}

// ── Sequence ──────────────────────────────────────────────────
function startQuestSequence(npc) {
    fadeToBlack(() => {
        showGameSelect(npc, (gameType) => {
            const onDone = (result) => {
                showResultsScreen(result, () => {
                    fadeFromBlack(() => {
                        cleanupQuestUI()
                        endDialogue()
                    })
                })
            }
            if (gameType === 'wire') launchWireGame(npc, onDone)
            else                     launchMemoryGame(npc, onDone)
        })
    })
}

// ── Game select screen ──────────────────────────────────────
function showGameSelect(npc, onPick) {
    const box = document.createElement('div')
    box.id = 'mgSelect'
    Object.assign(box.style, {
        position:'absolute', inset:'0', zIndex:'2001',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Courier New', Courier, monospace", color:'#fff8e6',
        padding: '10px'
    })
    box.innerHTML = `
        <div style="background:#9b6a2f;border:4px solid #3e2612;outline:2px solid #000;outline-offset:-6px;border-radius:12px;padding:min(4vh,18px) min(4vw,20px);text-align:center;max-width:92vw;max-height:92vh;">
            <div style="font-size:clamp(11px,2.6vh,15px);font-weight:bold;color:#f1c40f;text-shadow:2px 2px 0 #2a160b;margin-bottom:clamp(8px,2vh,14px);">CHOOSE YOUR CHALLENGE</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
                <button class="mg-pick-btn" data-g="wire" style="width:min(38vw,150px);padding:clamp(8px,2vh,14px) 8px;background:#3a1c05;border:2px solid #1c0d00;border-radius:8px;color:#fff8e6;font-family:inherit;font-weight:bold;cursor:pointer;font-size:clamp(9px,2vh,11px);line-height:1.5;">
                    🔧<br>FIX THE<br>WIRING
                </button>
                <button class="mg-pick-btn" data-g="memory" style="width:min(38vw,150px);padding:clamp(8px,2vh,14px) 8px;background:#3a1c05;border:2px solid #1c0d00;border-radius:8px;color:#fff8e6;font-family:inherit;font-weight:bold;cursor:pointer;font-size:clamp(9px,2vh,11px);line-height:1.5;">
                    🧠<br>MEMORY<br>MATCH
                </button>
            </div>
        </div>
    `
    document.querySelector('.canvas-wrapper').appendChild(box)
    box.querySelectorAll('.mg-pick-btn').forEach(b => {
        b.onclick = () => { const g = b.dataset.g; box.remove(); onPick(g) }
    })
}

// =====================================================
//  GAME 1 — WIRE REPAIR (3 levels, tap-to-connect, timer)
// =====================================================
function launchWireGame(npc, onComplete) {
    const LEVELS = [3, 4, 5]
    const TOTAL_TIME = 75
    const COLORS = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22']

    const container = document.createElement('div')
    container.id = 'wireGameContainer'
    Object.assign(container.style, {
        position:'absolute', inset:'0', zIndex:'2001',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:"'Courier New', Courier, monospace", color:'#fff8e6', touchAction:'none',
        padding: '6px', boxSizing: 'border-box'
    })
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:min(94vw,480px);font-weight:bold;font-size:clamp(10px,2.2vh,13px);margin-bottom:4px;">
            <div>🖥️ LVL <span id="wgLevel">1</span>/3</div>
            <div style="font-size:clamp(8px,1.7vh,10px);color:#f1c40f;font-weight:normal;">Tap left, then match color on right</div>
            <div>⭐<span id="wgScore">0</span> · ⏱<span id="wgTimer">${TOTAL_TIME}</span>s</div>
        </div>
        <canvas id="wgCanvas" style="border:3px solid #f1c40f;border-radius:8px;background:#111;touch-action:none;flex:0 1 auto;"></canvas>
        <button id="wgEndBtn" style="margin-top:6px;padding:6px 16px;background:#ae2012;border:2px solid #5b0000;border-radius:6px;color:#fff;font-family:inherit;font-weight:bold;cursor:pointer;font-size:clamp(9px,1.8vh,11px);">✕ End Game</button>
    `
    document.querySelector('.canvas-wrapper').appendChild(container)

    const cvs = container.querySelector('#wgCanvas')
    const gW = Math.min(window.innerWidth * 0.92, 480)
    const gH = Math.min(window.innerHeight * 0.62, 240)
    cvs.width = gW; cvs.height = gH
    const ctx = cvs.getContext('2d')

    const levelEl = container.querySelector('#wgLevel')
    const scoreEl = container.querySelector('#wgScore')
    const timerEl = container.querySelector('#wgTimer')
    const endBtn  = container.querySelector('#wgEndBtn')

    let score = 0, timeLeft = TOTAL_TIME, running = true
    let levelIdx = 0, left = [], right = [], selectedLeftIdx = null, flashBad = -1

    function buildLevel() {
        const count = LEVELS[levelIdx]
        const order = [...Array(count).keys()]
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[order[i], order[j]] = [order[j], order[i]]
        }
        const marginY = 28
        const spacing = (gH - marginY * 2) / Math.max(1, count - 1)
        left = Array.from({ length: count }, (_, i) => ({
            x: 32, y: count === 1 ? gH / 2 : marginY + i * spacing,
            color: COLORS[i], label: String.fromCharCode(65 + i), connected: false
        }))
        right = order.map((origIdx, p) => ({
            x: gW - 32, y: count === 1 ? gH / 2 : marginY + p * spacing,
            color: COLORS[origIdx], label: String.fromCharCode(65 + origIdx),
            origIdx, connected: false
        }))
        selectedLeftIdx = null
        levelEl.textContent = levelIdx + 1
    }
    buildLevel()

    function pointFromEvt(e) {
        const rect = cvs.getBoundingClientRect()
        const src  = e.changedTouches ? e.changedTouches[0] : e
        return {
            x: (src.clientX - rect.left) * (cvs.width / rect.width),
            y: (src.clientY - rect.top)  * (cvs.height / rect.height)
        }
    }
    function hitTest(list, x, y) {
        for (let i = 0; i < list.length; i++) {
            if (Math.hypot(x - list[i].x, y - list[i].y) <= 18) return i
        }
        return -1
    }

    function handleTap(e) {
        e.preventDefault()
        if (!running) return
        const { x, y } = pointFromEvt(e)

        const li = hitTest(left, x, y)
        if (li !== -1 && !left[li].connected) { selectedLeftIdx = li; return }

        const ri = hitTest(right, x, y)
        if (ri !== -1 && !right[ri].connected && selectedLeftIdx !== null) {
            if (right[ri].origIdx === selectedLeftIdx) {
                left[selectedLeftIdx].connected = true
                right[ri].connected = true
                score += 15
                scoreEl.textContent = score
                selectedLeftIdx = null
                if (left.every(l => l.connected)) {
                    score += 50
                    scoreEl.textContent = score
                    setTimeout(() => {
                        if (!running) return
                        if (levelIdx < LEVELS.length - 1) {
                            levelIdx++
                            buildLevel()
                        } else {
                            score += Math.max(0, timeLeft) * 2
                            finish()
                        }
                    }, 400)
                }
            } else {
                flashBad = ri
                setTimeout(() => { flashBad = -1 }, 300)
                selectedLeftIdx = null
            }
        }
    }
    cvs.addEventListener('click', handleTap)
    cvs.addEventListener('touchstart', handleTap, { passive: false })

    const timerInterval = setInterval(() => {
        if (!running) return
        timeLeft--
        timerEl.textContent = Math.max(0, timeLeft)
        if (timeLeft <= 0) finish()
    }, 1000)

    function drawTerminal(t, isSelected, isBad) {
        ctx.beginPath()
        ctx.arc(t.x, t.y, 14, 0, Math.PI * 2)
        ctx.fillStyle = t.connected ? '#2ecc71' : (isBad ? '#ff4444' : t.color)
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = isSelected ? 18 : 6
        ctx.fill()
        if (isSelected) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke() }
        ctx.shadowBlur = 0
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 10px Courier New'
        ctx.textAlign = 'center'
        ctx.fillText(t.label, t.x, t.y + 3)
    }

    function loop() {
        if (!running) return
        ctx.clearRect(0, 0, gW, gH)
        left.forEach((l, i) => {
            if (l.connected) {
                const r = right.find(rr => rr.origIdx === i)
                ctx.beginPath()
                ctx.moveTo(l.x, l.y)
                ctx.lineTo(r.x, r.y)
                ctx.strokeStyle = l.color
                ctx.lineWidth = 3
                ctx.stroke()
            }
        })
        left.forEach((l, i) => drawTerminal(l, selectedLeftIdx === i, false))
        right.forEach((r, i) => drawTerminal(r, false, flashBad === i))
        requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    function finish() {
        if (!running) return
        running = false
        clearInterval(timerInterval)
        container.remove()
        onComplete({ score, npc, gameName: 'Wire Repair' })
    }
    endBtn.onclick = finish
}

// =====================================================
//  GAME 2 — MEMORY MATCH
//  3 levels, 6 cards each (3 pairs), images only, one timer
// =====================================================
function launchMemoryGame(npc, onComplete) {
    const TOTAL_TIME = 90
    const LEVEL_COUNT = 3
    const PAIRS_PER_LEVEL = 3 // 3 pairs = 6 cards

    // Build a pool of unique buildings with valid images
    let pool = (typeof buildings !== 'undefined' ? buildings : [])
        .filter(b => b && b.name && b.image && b.image.src)
        .map(b => ({ name: b.name, src: b.image.src }))

    const seen = new Set()
    pool = pool.filter(b => (seen.has(b.name) ? false : (seen.add(b.name), true)))

    if (pool.length === 0) {
        pool = [{ name: 'Building', src: '' }]
    }

    const container = document.createElement('div')
    container.id = 'memoryGameContainer'
    Object.assign(container.style, {
        position:'absolute', inset:'0', zIndex:'2001',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:"'Courier New', Courier, monospace", color:'#fff8e6',
        padding: '6px', boxSizing: 'border-box'
    })
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:min(90vw,420px);font-weight:bold;font-size:clamp(10px,2.2vh,13px);margin-bottom:6px;">
            <div>🧠 LVL <span id="mmLevel">1</span>/${LEVEL_COUNT}</div>
            <div>⭐<span id="mmScore">0</span> · ⏱<span id="mmTimer">${TOTAL_TIME}</span>s</div>
        </div>
        <div id="mmGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(90vw,420px);"></div>
        <button id="mmEndBtn" style="margin-top:8px;padding:6px 16px;background:#ae2012;border:2px solid #5b0000;border-radius:6px;color:#fff;font-family:inherit;font-weight:bold;cursor:pointer;font-size:clamp(9px,1.8vh,11px);">✕ End Game</button>
    `
    document.querySelector('.canvas-wrapper').appendChild(container)

    const grid = container.querySelector('#mmGrid')
    const scoreEl = container.querySelector('#mmScore')
    const timerEl = container.querySelector('#mmTimer')
    const levelEl = container.querySelector('#mmLevel')
    const endBtn  = container.querySelector('#mmEndBtn')

    let score = 0, timeLeft = TOTAL_TIME, running = true
    let levelIdx = 0, deck = [], cardEls = [], flipped = [], matchedCount = 0, lock = false

    function pickBuildingsForLevel() {
        // Rotate through the pool so each level uses different buildings when possible
        const picks = []
        for (let i = 0; i < PAIRS_PER_LEVEL; i++) {
            picks.push(pool[(levelIdx * PAIRS_PER_LEVEL + i) % pool.length])
        }
        return picks
    }

    function buildLevel() {
        const picks = pickBuildingsForLevel()
        deck = []
        picks.forEach((p, i) => {
            deck.push({ pairId: i, src: p.src })
            deck.push({ pairId: i, src: p.src })
        })
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[deck[i], deck[j]] = [deck[j], deck[i]]
        }

        flipped = []
        matchedCount = 0
        lock = false
        levelEl.textContent = levelIdx + 1

        grid.innerHTML = ''
        cardEls = deck.map((card, idx) => {
            const el = document.createElement('div')
            el.className = 'mm-card'
            Object.assign(el.style, {
                aspectRatio: '1/1', borderRadius: '8px', cursor: 'pointer',
                background: '#3a1c05', border: '2px solid #1c0d00',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(18px,4vh,26px)', userSelect: 'none', overflow: 'hidden'
            })
            el.textContent = '❓'
            el.addEventListener('click', () => onCardTap(idx, el))
            grid.appendChild(el)
            return el
        })
    }

    function renderFaceUp(el, card) {
        el.innerHTML = ''
        el.style.background = '#5b2f07'
        if (card.src) {
            const img = document.createElement('img')
            img.src = card.src
            Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover' })
            el.appendChild(img)
        } else {
            el.textContent = '🏢'
        }
    }
    function renderFaceDown(el) {
        el.innerHTML = ''
        el.style.background = '#3a1c05'
        el.style.border = '2px solid #1c0d00'
        el.textContent = '❓'
    }

    function onCardTap(idx, el) {
        if (!running || lock) return
        if (el.classList.contains('mm-matched')) return
        if (flipped.find(f => f.idx === idx)) return

        renderFaceUp(el, deck[idx])
        flipped.push({ idx, el })

        if (flipped.length === 2) {
            lock = true
            const [a, b] = flipped
            if (deck[a.idx].pairId === deck[b.idx].pairId) {
                a.el.classList.add('mm-matched')
                b.el.classList.add('mm-matched')
                a.el.style.border = '2px solid #4caf50'
                b.el.style.border = '2px solid #4caf50'
                score += 20
                scoreEl.textContent = score
                matchedCount++
                flipped = []
                lock = false

                if (matchedCount === PAIRS_PER_LEVEL) {
                    score += 30
                    scoreEl.textContent = score
                    setTimeout(() => {
                        if (!running) return
                        if (levelIdx < LEVEL_COUNT - 1) {
                            levelIdx++
                            buildLevel()
                        } else {
                            score += Math.max(0, timeLeft) * 2
                            finish()
                        }
                    }, 500)
                }
            } else {
                setTimeout(() => {
                    renderFaceDown(a.el)
                    renderFaceDown(b.el)
                    flipped = []
                    lock = false
                }, 650)
            }
        }
    }

    buildLevel()

    const timerInterval = setInterval(() => {
        if (!running) return
        timeLeft--
        timerEl.textContent = Math.max(0, timeLeft)
        if (timeLeft <= 0) finish()
    }, 1000)

    function finish() {
        if (!running) return
        running = false
        clearInterval(timerInterval)
        container.remove()
        onComplete({ score, npc, gameName: 'Memory Match' })
    }
    endBtn.onclick = finish
}

// ── Results screen ───────────────────────────────────────────
function showResultsScreen(result, cb) {
    // Kick off the real progress submission (XP, cooldown, achievements)
ProgressService.submitResult(result.npc.id, result.gameName, result.score)
    .then(res => {
        if (res.status !== 'success') return

        if (typeof refreshXpBar === 'function') refreshXpBar()

        if (res.newly_unlocked && res.newly_unlocked.length > 0) {
            res.newly_unlocked.forEach((ach, i) => {
                setTimeout(() => showAchievementToast(ach), i * 4000)   // stagger if multiple unlock at once
            })
        }
    })
    .catch(() => console.warn('Failed to submit minigame result'))

    let total = 0
    try {
        total = parseInt(localStorage.getItem('tabula_quest_points') || '0', 10) + result.score
        localStorage.setItem('tabula_quest_points', total)
    } catch (e) { total = result.score }

    const box = document.createElement('div')
    box.id = 'mgResults'
    Object.assign(box.style, { position:'absolute', inset:'0', zIndex:'2002', display:'flex', alignItems:'center', justifyContent:'center', padding:'10px' })
    box.innerHTML = `
        <div style="background:#9b6a2f;border:4px solid #3e2612;outline:2px solid #000;outline-offset:-6px;border-radius:12px;box-shadow:0 6px 0 #2a160b,0 12px 30px rgba(0,0,0,0.5);padding:clamp(14px,3vh,26px) clamp(18px,4vw,32px);text-align:center;font-family:'Courier New',Courier,monospace;color:#fff8e6;max-width:90vw;max-height:90vh;">
            <div style="font-size:clamp(13px,2.6vh,17px);font-weight:bold;color:#f1c40f;text-shadow:2px 2px 0 #2a160b;margin-bottom:5px;">${escQuest(result.gameName || 'QUEST')} COMPLETE!</div>
            <div style="font-size:clamp(10px,2vh,13px);margin-bottom:10px;">${escQuest(result.npc.name)} thanks you!</div>
            <div style="font-size:clamp(24px,5vh,34px);font-weight:bold;color:#f1c40f;margin-bottom:4px;">+${result.score} PTS</div>
            <div style="font-size:clamp(9px,1.6vh,11px);color:#d8c39a;margin-bottom:14px;">Total: ${total}</div>
            <button id="mgContinueBtn" style="padding:10px 22px;background:#4caf50;border:2px solid #1e3a20;border-radius:8px;color:#fff;font-family:inherit;font-weight:bold;cursor:pointer;font-size:clamp(10px,2vh,12px);">Continue</button>
        </div>
    `
    document.querySelector('.canvas-wrapper').appendChild(box)
    box.querySelector('#mgContinueBtn').onclick = () => { box.remove(); cb() }
}

function escQuest(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}