// Pitch slot layouts by format (coords = % of the pitch container).
// Team A sits in the top half (own goal at top), Team B mirrors it.
// 7-a-side = 1-2-3-1, 9-a-side = 1-3-3-2, 10-a-side = 1-3-4-2. Array order = slot index.
import { DEFAULT_FORMAT, POSITION_ORDER } from '../../lib/constants'

const mirror = (slots) => slots.map((s) => ({ ...s, y: 100 - s.y }))

const SEVEN = [
  { label: 'GK',  x: 50, y: 9  },
  { label: 'DEF', x: 28, y: 22 },
  { label: 'DEF', x: 72, y: 22 },
  { label: 'MID', x: 15, y: 35 },
  { label: 'MID', x: 50, y: 35 },
  { label: 'MID', x: 85, y: 35 },
  { label: 'FWD', x: 50, y: 46 },
]
const NINE = [
  { label: 'GK',  x: 50, y: 7  },
  { label: 'DEF', x: 22, y: 19 },
  { label: 'DEF', x: 50, y: 19 },
  { label: 'DEF', x: 78, y: 19 },
  { label: 'MID', x: 22, y: 33 },
  { label: 'MID', x: 50, y: 33 },
  { label: 'MID', x: 78, y: 33 },
  { label: 'FWD', x: 35, y: 46 },
  { label: 'FWD', x: 65, y: 46 },
]

const TEN = [
  { label: 'GK',  x: 50, y: 6  },
  { label: 'DEF', x: 20, y: 17 },
  { label: 'DEF', x: 50, y: 17 },
  { label: 'DEF', x: 80, y: 17 },
  { label: 'MID', x: 13, y: 30 },
  { label: 'MID', x: 38, y: 30 },
  { label: 'MID', x: 62, y: 30 },
  { label: 'MID', x: 87, y: 30 },
  { label: 'FWD', x: 35, y: 43 },
  { label: 'FWD', x: 65, y: 43 },
]

export const FORMATIONS = {
  7: { A: SEVEN, B: mirror(SEVEN) },
  9: { A: NINE, B: mirror(NINE) },
  10: { A: TEN, B: mirror(TEN) },
}

// Turn a team's player IDs into [{ playerId, x, y }] using the formation as the starting layout.
// Players fill a slot matching their position first, then any free slot; anyone beyond the
// available slots is spread along the centre line so nobody is stranded.
export function layOutTeam(playerIds, playerById, team, format) {
  const slotDefs = (FORMATIONS[format] ?? FORMATIONS[DEFAULT_FORMAT])[team]
  const sorted = playerIds
    .map((id) => playerById.get(id))
    .filter(Boolean)
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 2) - (POSITION_ORDER[b.position] ?? 2))

  const slots = Array(slotDefs.length).fill(null)
  const placed = new Set()
  for (const p of sorted) {
    const i = slotDefs.findIndex((s, idx) => s.label === p.position && slots[idx] === null)
    if (i !== -1) { slots[i] = p.id; placed.add(p.id) }
  }
  for (const p of sorted) {
    if (placed.has(p.id)) continue
    const i = slots.indexOf(null)
    if (i === -1) break
    slots[i] = p.id
    placed.add(p.id)
  }

  const result = slots
    .map((playerId, i) => (playerId ? { playerId, x: slotDefs[i].x, y: slotDefs[i].y } : null))
    .filter(Boolean)

  const extras = sorted.filter((p) => !placed.has(p.id))
  const baseY = team === 'A' ? 48 : 52
  extras.forEach((p, k) => {
    const x = extras.length === 1 ? 50 : 12 + (76 * k) / (extras.length - 1)
    result.push({ playerId: p.id, x, y: baseY })
  })
  return result
}
