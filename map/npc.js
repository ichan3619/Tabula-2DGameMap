// =============================================
    //  npc.js — NPC System
    //  Loads NPCs from api_npcs.php, renders them
    //  on the map, detects proximity, and runs
    //  the dialogue panel.
    // =============================================

    const npcs = []          // all loaded NPC objects
    let activeNPC    = null  // NPC currently in dialogue
    let dialogueLine = 0     // current line index
    let questPending = false // ADD THIS LINE

    // ── Dialogue DOM refs (built once) ──
    let dlgPanel  = null
    let dlgName   = null
    let dlgText   = null
    let dlgNext   = null
    let dlgClose  = null

    // ── Proximity prompt ref ──
    let npcPrompt = null
    let npcPromptTarget = null  // which NPC the prompt is for

    // =============================================
    //  LOAD NPCs FROM API
    // =============================================
    async function loadNPCs() {
        try {
            const res  = await fetch('../php/api_npc.php')
            if (!res.ok) { console.error('Failed to load NPCs:', res.status); return }
            const data = await res.json()
            if (data.error) { console.error('NPC API error:', data.error); return }

            data.forEach(n => {
                const img     = new Image()
                img.decoding  = 'async'
                img.src       = n.image

                const npc = {
                    id:          n.id,
                    name:        n.name,
                    image:       img,
                    zoneRadius:  n.zone_radius,
                    dialogue:    n.dialogue,   // string[]
                    basePosition:{ x: n.x, y: n.y },
                    position:    { x: n.x, y: n.y },  // updated when map moves
                    // Collision box, expressed as ratios of the NPC's own image size —
                    // same convention as building.collision in index.js.
                    // Defaults to a box around the NPC's feet so the sprite's head/name-tag
                    // area doesn't block the player.
                    collision:   n.collision || { x: 0.2, y: 0.65, width: 0.6, height: 0.3 },
                }

                npcs.push(npc)
                console.log('NPC loaded:', npc.name, 'at', npc.position.x, npc.position.y)
                movables.push(npc)  // so NPC moves with the map like buildings do
            })
        } catch (e) {
            console.error('NPC load error:', e)
        }
    }

    // =============================================
    //  RENDER — single NPC
    //  Called per-NPC from index.js's sorted render
    //  loop (sortedRenderables), so NPCs draw in the
    //  correct front/behind order relative to the
    //  player and buildings instead of always on top.
    // =============================================
    function drawNPC(npc) {
        if (!npc.image || !npc.image.complete || npc.image.naturalWidth === 0) return
        const w = npc.image.naturalWidth || 64
        const h = npc.image.naturalHeight || 64
        const x = Math.round(npc.position.x)
        const y = Math.round(npc.position.y)
        const bob = Math.abs(Math.sin(Date.now() / 800) * 5)
        const tagY = y - 8

        c.save()
        if (activeNPC && activeNPC !== npc) c.globalAlpha = 0.5
        c.drawImage(npc.image, x, y - bob, w, h)

        // Name tag
        c.font      = 'bold 11px Courier New'
        c.textAlign = 'center'
        c.fillStyle = 'rgba(0,0,0,0.7)'
        c.fillText(npc.name, x + w / 2 + 1, tagY + 1)
        c.fillStyle = '#f1c40f'
        c.fillText(npc.name, x + w / 2, tagY)
        c.textAlign = 'left'
        c.restore()

        // "!"
        if (isPlayerNearNPC(npc) && !activeNPC) {
            const bounce = Math.sin(Date.now() / 300) * 4
            c.save()
            c.font      = 'bold 16px Courier New'
            c.textAlign = 'center'
            c.fillStyle = '#f1c40f'
            c.shadowBlur  = 4
            c.shadowColor = '#000'
            c.fillText('!', x + w / 2, tagY - 14 + bounce)
            c.restore()
        }

        if (DEBUG) {
            const col = npc.collision
            c.save()
            c.globalAlpha = 0.4
            c.fillStyle   = 'lime'
            c.fillRect(x + w * col.x, y + h * col.y, w * col.width, h * col.height)
            c.restore()
        }
    }

    // =============================================
    //  PROXIMITY
    // =============================================
    function isPlayerNearNPC(npc) {
        const w = npc.image.naturalWidth || 64
        const h = npc.image.naturalHeight || 64
        const px = player.position.x + player.width  / 2
        const py = player.position.y + player.height / 2
        const nx = npc.position.x + w / 2
        const ny = npc.position.y + h / 2
        return Math.hypot(px - nx, py - ny) < npc.zoneRadius
    }
    // Called every frame from animate() in index.js
    function checkNPCProximity() {
        // Don't show prompts during dialogue, panning, or non-free states
        if (activeNPC) { hideNPCPrompt(); return }
        if (state !== GameState.FREE) { hideNPCPrompt(); return }

        let found = null
        for (const npc of npcs) {
            if (isPlayerNearNPC(npc)) { found = npc; break }
        }

        if (found) {
            if (npcPromptTarget !== found) {
                npcPromptTarget = found
                showNPCPrompt(found)
            }
        } else {
            if (npcPromptTarget) {
                npcPromptTarget = null
                hideNPCPrompt()
            }
        }
    }

    function showNPCPrompt(npc) {
        if (!npcPrompt) buildNPCPrompt()
        npcPrompt.querySelector('.npc-prompt-name').textContent = npc.name
        npcPrompt.querySelector('.npc-talk-btn').onclick = () => startDialogue(npc)
        npcPrompt.style.display = 'flex'
    }

    function hideNPCPrompt() {
        if (npcPrompt) npcPrompt.style.display = 'none'
    }

    function buildNPCPrompt() {
        npcPrompt = document.createElement('div')
        npcPrompt.id = 'npcPrompt'
        npcPrompt.innerHTML = `
            <span class="npc-prompt-name"></span>
            <button class="npc-talk-btn">💬 TALK</button>
        `
        // Inline styles so this never depends on style.css having a matching rule.
        Object.assign(npcPrompt.style, {
            position: 'absolute',
            left: '50%',
            bottom: '18%',
            transform: 'translateX(-50%)',
            display: 'none',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            background: 'rgba(20,10,5,0.85)',
            border: '2px solid #f1c40f',
            borderRadius: '10px',
            color: '#fff8e6',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '13px',
            zIndex: '500',
            pointerEvents: 'auto',
        })
        const btn = npcPrompt.querySelector('.npc-talk-btn')
        Object.assign(btn.style, {
            background: '#f1c40f',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'inherit',
        })
        document.querySelector('.canvas-wrapper').appendChild(npcPrompt)
    }

    // =============================================
    //  DIALOGUE
    // =============================================
    function buildDialoguePanel() {
        dlgPanel = document.createElement('div')
        dlgPanel.id = 'dialoguePanel'
        dlgPanel.innerHTML = `
            <div class="dlg-portrait" id="dlgPortrait"></div>
            <div class="dlg-body">
                <div class="dlg-name" id="dlgName"></div>
                <div class="dlg-text" id="dlgText"></div>
                <div class="dlg-actions">
                    <button class="dlg-btn" id="dlgNext">Next ▶</button>
                    <button class="dlg-btn dlg-btn-close" id="dlgClose">✕ Close</button>
                </div>
            </div>
        `

        // Inline styles so this panel is ALWAYS visible on top of the canvas,
        // even if style.css has no rule (or a broken one) for #dialoguePanel.
        Object.assign(dlgPanel.style, {
            position: 'absolute',
            left: '50%',
            bottom: '5%',
            transform: 'translateX(-50%)',
            display: 'none',
            alignItems: 'stretch',
            gap: '14px',
            width: 'min(90%, 640px)',
            minHeight: '110px',
            background: 'rgba(15,8,4,0.92)',
            border: '3px solid #f1c40f',
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#fff8e6',
            zIndex: '1000',
            pointerEvents: 'auto',
            boxSizing: 'border-box',
        })

        const portrait = dlgPanel.querySelector('#dlgPortrait')
        Object.assign(portrait.style, {
            flex: '0 0 72px',
            width: '72px',
            height: '72px',
            borderRadius: '8px',
            border: '2px solid #f1c40f',
            backgroundColor: 'rgba(255,255,255,0.08)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            imageRendering: 'pixelated',
        })

        const body = dlgPanel.querySelector('.dlg-body')
        Object.assign(body.style, { flex: '1', display: 'flex', flexDirection: 'column', minWidth: '0' })

        const name = dlgPanel.querySelector('#dlgName')
        Object.assign(name.style, { fontWeight: 'bold', color: '#f1c40f', marginBottom: '6px', fontSize: '14px' })

        const text = dlgPanel.querySelector('#dlgText')
        Object.assign(text.style, { flex: '1', fontSize: '13px', lineHeight: '1.5', wordBreak: 'break-word' })

        const actions = dlgPanel.querySelector('.dlg-actions')
        Object.assign(actions.style, { display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' })

        dlgPanel.querySelectorAll('.dlg-btn').forEach(b => {
            Object.assign(b.style, {
                background: '#f1c40f', border: 'none', borderRadius: '6px',
                padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '12px',
            })
        })
        const closeBtn = dlgPanel.querySelector('#dlgClose')
        Object.assign(closeBtn.style, { background: '#555' , color: '#fff' })

        document.querySelector('.canvas-wrapper').appendChild(dlgPanel)

        dlgName  = document.getElementById('dlgName')
        dlgText  = document.getElementById('dlgText')
        dlgNext  = document.getElementById('dlgNext')
        dlgClose = document.getElementById('dlgClose')

        dlgNext.addEventListener('click',  advanceDialogue)
        dlgClose.addEventListener('click', endDialogue)
    }

    function startDialogue(npc) {
        try {
            if (!dlgPanel) buildDialoguePanel()

            activeNPC    = npc
ProgressService.logNpcTalk(npc.id).then(res => {
    if (res.status === 'success') {
        if (typeof refreshXpBar === 'function') { refreshXpBar() }
        const unlocked = res.newly_unlocked || []
        unlocked.forEach((ach, i) => {
            setTimeout(() => showAchievementToast(ach), i * 4000)
        })
    }
})
            dialogueLine = 0
            freezePlayer = true
            resetKeys()
            hideNPCPrompt()

            // Portrait — show NPC sprite as a small image
            const portrait = document.getElementById('dlgPortrait')
            if (portrait) {
                if (npc.image.complete && npc.image.naturalWidth > 0) {
                    portrait.style.backgroundImage = `url('${npc.image.src}')`
                } else {
                    portrait.style.backgroundImage = ''
                }
            }

            dlgName.textContent = npc.name
            showDialogueLine()
            dlgPanel.style.display = 'flex'
        } catch (err) {
            // Never leave the player stuck frozen with no visible dialogue —
            // log the real error and roll back to a clean, movable state.
            console.error('startDialogue failed:', err)
            endDialogue()
        }
    }

    function showDialogueLine() {
        if (!activeNPC) return
        const lines = Array.isArray(activeNPC.dialogue) ? activeNPC.dialogue : []
        if (lines.length === 0) {
            console.warn(`NPC "${activeNPC.name}" has no dialogue lines (check the "dialogue" column in the DB — it must be a JSON array of strings).`)
        }
        const line = lines[dialogueLine] || '...'

        // Typewriter effect
        typewriterEffect(dlgText, line, 28)

        // Update Next button label
        dlgNext.textContent = dialogueLine >= lines.length - 1 ? 'Done ▶' : 'Next ▶'
    }

async function advanceDialogue() {
    if (!activeNPC || questPending) return
    const lines = Array.isArray(activeNPC.dialogue) ? activeNPC.dialogue : []

    if (dialogueLine < lines.length - 1) {
        dialogueLine++
        showDialogueLine()
        return
    }

    if (typeof offerQuest !== 'function') {
        endDialogue()
        return
    }

    questPending = true
    dlgNext.disabled = true   // prevent double-clicks while we check

    const available = await ProgressService.isNpcAvailable(activeNPC.id)

    dlgNext.disabled = false

    if (available) {
        offerQuest(activeNPC)
    } else {
        questPending = false
        typewriterEffect(dlgText, "I'm still catching my breath from last time — check back in a bit!", 28)
        dlgNext.textContent = 'Done ▶'
        // Next click on "Done" just closes the dialogue instead of offering a quest again
        dlgNext.onclick = () => { endDialogue(); dlgNext.onclick = advanceDialogue }
    }
}

    function endDialogue() {
        if (dlgPanel) dlgPanel.style.display = 'none'
        activeNPC    = null
        dialogueLine = 0
        freezePlayer = false
    }

    // ── Safety net: Escape always exits a dialogue, no matter what else went wrong ──
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && activeNPC) endDialogue()
    })

    // ── Typewriter effect ──
    let typewriterTimer = null
    function typewriterEffect(el, text, speed = 30) {
        if (typewriterTimer) clearInterval(typewriterTimer)
        el.textContent = ''
        let i = 0
        typewriterTimer = setInterval(() => {
            el.textContent += text[i]
            i++
            if (i >= text.length) clearInterval(typewriterTimer)
        }, speed)
    }