// =============================================
//  progressService.js
//  Single shared interface for XP, levels,
//  achievements, and NPC cooldowns.
//
//  Signed-in users  -> talks to the real PHP endpoints, saved in DB.
//  Guests           -> everything lives in memory only, lost on refresh.
//
//  Nothing else in the game should care which
//  mode it's in — always call ProgressService.xxx()
// =============================================

const XP_BASE = 50   // must match the curve used anywhere XP is displayed

function xpNeededForLevel(level) {
    return XP_BASE * level * level
}

function levelFromXp(totalXp) {
    let level = 1
    while (totalXp >= xpNeededForLevel(level)) {
        totalXp -= xpNeededForLevel(level)
        level++
    }
    return {
        level,
        xpIntoLevel: totalXp,
        xpForNextLevel: xpNeededForLevel(level)
    }
}

const ProgressService = (function () {
    const isGuest = !localStorage.getItem('userEmail')

    // ── Guest (in-memory only) state ──────────────────────────────────────
    let guestState = {
        totalXp: 0,
        achievements: [],   // array of unlocked achievement keys
        cooldowns: {}        // { npcId: timestampMs }
    }

    // ── Signed-in: fetch current totals from the server ─────────────────
    async function fetchProgress() {
        if (isGuest) {
            const level = levelFromXp(guestState.totalXp)
            return {
                totalXp: guestState.totalXp,
                ...level,
                achievements: guestState.achievements,
                allAchievements: []   // guests don't get a full achievement list — keep it simple
            }
        }

const res = await fetch('../php/get_player_progress.php')
const data = await res.json()
if (data.status !== 'success') return { totalXp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: XP_BASE, achievements: [], allAchievements: [] }

const level = levelFromXp(data.total_xp)
return {
    totalXp: data.total_xp,
    ...level,
    achievements: data.achievements || [],
    allAchievements: data.all_achievements || []
}
    }

    // ── Check if an NPC is currently available (not on cooldown) ────────
    async function isNpcAvailable(npcId) {
        if (isGuest) {
            const until = guestState.cooldowns[npcId]
            return !until || Date.now() >= until
        }

        const res = await fetch(`../php/get_npc_availability.php?npc_id=${npcId}`)
        const data = await res.json()
        return data.status === 'success' ? data.available : true
    }

    // ── Submit a finished minigame result ────────────────────────────────
    async function submitResult(npcId, gameKey, score) {
        if (isGuest) {
            const xpAwarded = Math.min(100, Math.round(score / 2))
            guestState.totalXp += xpAwarded
            guestState.cooldowns[npcId] = Date.now() + 15 * 60 * 1000   // 15 min, mirrors server value

            const newlyUnlocked = []
            if (!guestState.achievements.includes('first_quest')) {
                guestState.achievements.push('first_quest')
                newlyUnlocked.push({ key: 'first_quest', name: 'First Steps', description: 'Complete your first minigame quest', xp_reward: 20 })
                guestState.totalXp += 20
            }

            return {
                status: 'success',
                xp_awarded: xpAwarded,
                total_xp: guestState.totalXp,
                newly_unlocked: newlyUnlocked,
                cooldown_minutes: 15
            }
        }

        const res = await fetch('../php/submit_minigame_result.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npc_id: npcId, game_key: gameKey, score })
        })
        return res.json()
    }

    async function logBuildingVisit(buildingId) {
        if (isGuest) {
            guestState.visitedBuildings = guestState.visitedBuildings || new Set()
            if (!guestState.visitedBuildings.has(buildingId)) {
                guestState.visitedBuildings.add(buildingId)
            }
            return { status: 'success', newly_unlocked: [] }   // guests skip real achievement checks here
        }

        const res = await fetch('../php/log_building_visit.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ building_id: buildingId })
        })
        return res.json()
    }

    async function logNpcTalk(npcId) {
        if (isGuest) {
            guestState.talkedNpcs = guestState.talkedNpcs || new Set()
            guestState.talkedNpcs.add(npcId)
            return { status: 'success', newly_unlocked: [] }
        }

        const res = await fetch('../php/log_npc_talk.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npc_id: npcId })
        })
        return res.json()
    }
    
    
    return {
        isGuest,
        fetchProgress,
        isNpcAvailable,
        submitResult,
		logBuildingVisit, 
        logNpcTalk,  
        levelFromXp   // exported so UI code can reuse the same curve
    }
})()