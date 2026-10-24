// App-wide constants and colour tokens. Hex values mirror the @theme palette in index.css
// and are only used where a class can't be (inline dynamic styles, Recharts, SVG).

export const APP_NAME = 'Sunday FC'

// ── Seasonal break ─────────────────────────────────────────────
// While today is before `until`, the Home countdown targets that date instead of next Sunday.
// Leave a past date (or null) when there is no break.
export const BREAK = { until: '2026-03-22', label: 'Ramadan Break' }

// ── Thresholds ─────────────────────────────────────────────────
export const REGULAR_THRESHOLD = 10     // all-time games to count as a "regular"
export const MIN_STREAK_GAMES = 3       // season games before streaks/attendance are shown
export const STREAK_BADGE = 3           // consecutive results that earn a fire / frost badge
export const MIN_BALANCE_PLAYERS = 12   // players needed before the balancer will suggest teams
export const MIN_RATED_GAMES = 5        // games before a win rate is trusted as a rating
export const DEFAULT_FORMAT = 7
export const FORMATS = [7, 9, 10]       // players per side we have pitch layouts for

// Smallest format that fits a team of this size (8 → 9-a-side, 11 → the largest we support)
export const formatForSize = (size) => FORMATS.find((f) => size <= f) ?? FORMATS[FORMATS.length - 1]
export const DEFAULT_REPORT_AUTHOR = 'h-shez'

// Townhead Power League, Glasgow — used for match-day weather lookups
export const PITCH_LOCATION = { latitude: 55.8636, longitude: -4.2378 }

// ── Positions ──────────────────────────────────────────────────
export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
export const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
export const POSITION_META = {
  GK:  { full: 'Goalkeeper', color: '#f59e0b', bg: '#3d2c00' },
  DEF: { full: 'Defender',   color: '#3b82f6', bg: '#1e3a5f' },
  MID: { full: 'Midfielder', color: '#16a34a', bg: '#14532d' },
  FWD: { full: 'Forward',    color: '#ef4444', bg: '#3d1515' },
}
export const positionOf = (player) => (POSITION_META[player?.position] ? player.position : 'MID')

// ── Teams ──────────────────────────────────────────────────────
export const TEAM = {
  A: { key: 'A', label: 'Team A', color: '#16a34a', text: '#22c55e', dim: '#14532d', deep: '#0d2114' },
  B: { key: 'B', label: 'Team B', color: '#3b82f6', text: '#60a5fa', dim: '#1e3a5f', deep: '#0d1626' },
}

// ── Result colours ─────────────────────────────────────────────
export const RESULT_COLOR = { W: '#22c55e', D: '#64748b', L: '#ef4444' }

export function winColor(pct) {
  if (pct >= 60) return '#22c55e'
  if (pct >= 40) return '#f59e0b'
  return '#ef4444'
}
export function winBg(pct) {
  if (pct >= 60) return '#14532d'
  if (pct >= 40) return '#3d2c00'
  return '#2d1515'
}
