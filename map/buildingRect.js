// =============================================
//  buildingRect.js
//  SHARED by both the game (index.js) and the
//  map editor (edit_map.php).
//
//  This is the ONLY place that decides where a
//  building is drawn and how big it is.
//  If you ever need to change the math, change
//  it here — never in index.js or edit_map.php
//  directly.
// =============================================

const BUILDING_SCALE = 2   // must match whatever "scale" you use elsewhere

function getBuildingRect(b) {
    return {
        x: b.x !== undefined ? b.x : (b.map_x || 0),
        y: b.y !== undefined ? b.y : (b.map_y || 0),
        w: Math.round((b.width  || (b.image && b.image.width)  || 100) * BUILDING_SCALE),
        h: Math.round((b.height || (b.image && b.image.height) || 100) * BUILDING_SCALE)
    }
}