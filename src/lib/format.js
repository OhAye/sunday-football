// Date and text formatting helpers. All dates are local-time 'YYYY-MM-DD' strings.
import { BREAK } from './constants'

export function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayYMD = () => toYMD(new Date())
export const currentYear = () => String(new Date().getFullYear())
export const parseYMD = (dateStr) => new Date(`${dateStr}T00:00:00`)

const FORMATS = {
  short: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, // Sun, 4 Oct 2026
  day:   { weekday: 'long', day: 'numeric', month: 'long' },                    // Sunday 4 October
  tiny:  { day: 'numeric', month: 'short' },                                    // 4 Oct
}
export function fmtDate(dateStr, style = 'short') {
  if (!dateStr) return ''
  return parseYMD(dateStr).toLocaleDateString('en-GB', FORMATS[style] ?? FORMATS.short)
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Next matchday for the Home countdown. Honours the seasonal break in constants.js.
export function getNextMatchday() {
  const today = startOfToday()
  if (BREAK?.until) {
    const breakUntil = parseYMD(BREAK.until)
    if (today < breakUntil) {
      return { date: toYMD(breakUntil), daysUntil: Math.round((breakUntil - today) / 86400000), isOnBreak: true }
    }
  }
  const dow = today.getDay() // 0 = Sunday
  const daysUntil = dow === 0 ? 0 : 7 - dow
  const next = new Date(today)
  next.setDate(today.getDate() + daysUntil)
  return { date: toYMD(next), daysUntil, isOnBreak: false }
}

// Upcoming Sunday (today if it is Sunday) — the default date when planning teams.
export function upcomingSunday() {
  const d = startOfToday()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return toYMD(d)
}

// Sunday closest to today — the default date when recording a match.
// Mon–Wed points back at the game just played, Thu–Sat at the one coming up.
export function nearestSunday() {
  const d = startOfToday()
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow <= 3 ? -dow : 7 - dow))
  return toYMD(d)
}

// WMO weather code → emoji
export function weatherEmoji(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

export const firstName = (name = '') => name.split(' ')[0]
export const initialOf = (name = '') => (name.trim()[0] ?? '?').toUpperCase()
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null)

// 'Omar Khan' → 'h-omar-khan' (matches the h-{firstname} player ID convention)
export function slugify(name = '') {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
