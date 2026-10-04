// Turn a pasted WhatsApp teams message into two lists of squad players.
//
// Expected shape (anything above the teams line is ignored):
//   1. Shehzad            ← optional numbered sign-up list; helps split multi-word names
//   2. Saq Y
//   *Shehzad Saq Y Tony V Jonny Usman G Matt*   ← names separated by spaces, teams by "V" / "vs"
//
// Also accepted: names separated by commas, and teams on separate lines with a lone "v" between them.
// Pure functions — no React, no Supabase.

const MAX_NAME_WORDS = 3

// Lowercase, strip accents, WhatsApp formatting, emoji and punctuation
export function normalizeName(text = '') {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isSubsequence = (short, long) => {
  let i = 0
  for (const ch of long) if (ch === short[i]) i++
  return i === short.length
}

// Could these two single words be the same name? ("saqib" ~ "saq", "shehzad" ~ "shez", "a" ~ "a")
function wordsRelated(a, b) {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < 3 || short[0] !== long[0]) return false
  if (long.startsWith(short)) return true
  return short.length / long.length >= 0.5 && isSubsequence(short, long)
}

// How well a pasted name fits a squad name. 0 = no match.
function similarity(tokenWords, nameWords) {
  if (tokenWords.length > 1 && nameWords.length > 1) {
    if (tokenWords.length !== nameWords.length) return 0
    return tokenWords.every((w, i) => wordsRelated(w, nameWords[i])) ? 3 : 0 // "saqib a" → "Saq A"
  }
  if (tokenWords.length > 1) return tokenWords[0] === nameWords[0] ? 2 : 0     // "chris b" → "Chris"
  if (nameWords.length > 1) return tokenWords[0] === nameWords[0] ? 1 : 0     // "usman" → "Usman A" / "Usman G"
  return wordsRelated(tokenWords[0], nameWords[0]) ? 2 : 0                    // "shehzad" → "Shez"
}

// { status: 'exact' | 'guess' | 'unknown', playerId, candidates: [playerId] }
export function matchPlayer(rawName, players) {
  const token = normalizeName(rawName)
  for (const p of players) {
    if (normalizeName(p.name) === token) return { status: 'exact', playerId: p.id, candidates: [] }
  }
  for (const p of players) {
    if ((p.aliases ?? []).some((a) => normalizeName(a) === token)) return { status: 'exact', playerId: p.id, candidates: [] }
  }
  const tokenWords = token.split(' ')
  const scored = players
    .map((p) => ({ id: p.id, score: similarity(tokenWords, normalizeName(p.name).split(' ')) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  if (scored.length === 0) return { status: 'unknown', playerId: null, candidates: [] }
  const best = scored.filter((x) => x.score === scored[0].score)
  // One clear front-runner is a guess to confirm; several equally good ones need a human
  if (best.length === 1) return { status: 'guess', playerId: best[0].id, candidates: scored.map((x) => x.id) }
  return { status: 'unknown', playerId: null, candidates: scored.map((x) => x.id) }
}

const stripFormatting = (line) => line.replace(/[*_~`]/g, ' ').replace(/\s+/g, ' ').trim()
const VERSUS = /\s+(?:v|vs|vs\.|versus)\s+/i
const LONE_VERSUS = /^(?:v|vs|vs\.|versus)$/i
const LIST_ITEM = /^\s*\d{1,2}\s*[.)\-:]\s*(.+)$/

// Split "Shehzad Saq Y Tony" into names. Multi-word names are recognised from the squad,
// its aliases and the sign-up list; a lone letter always belongs to the name before it.
function splitNames(text, knownNames) {
  if (/[,\n]/.test(text)) {
    return text
      .split(/[,\n]/)
      .map((s) => s.replace(/^\s*\d{1,2}\s*[.)\-:]\s*/, '').trim())
      .filter((s) => normalizeName(s) && !/^team\b/i.test(s)) // drop "Team A" style headings
  }
  const words = text.split(' ').filter(Boolean)
  const names = []
  for (let i = 0; i < words.length;) {
    let taken = 1
    for (let n = Math.min(MAX_NAME_WORDS, words.length - i); n > 1; n--) {
      if (knownNames.has(normalizeName(words.slice(i, i + n).join(' ')))) { taken = n; break }
    }
    if (taken === 1 && i + 1 < words.length && normalizeName(words[i + 1]).length === 1) taken = 2
    const name = words.slice(i, i + taken).join(' ')
    if (normalizeName(name)) names.push(name)
    i += taken
  }
  return names
}

// → { ok: true, teamA: [entry], teamB: [entry] } | { ok: false, error }
//   entry: { raw, status, playerId, candidates }
export function parseTeamsMessage(message, players) {
  const lines = message.split(/\r?\n/).map(stripFormatting)

  const listNames = lines.map((l) => l.match(LIST_ITEM)?.[1]?.trim()).filter(Boolean)
  const knownNames = new Set([
    ...players.flatMap((p) => [p.name, ...(p.aliases ?? [])]),
    ...listNames,
  ].map(normalizeName))

  let sideA = null, sideB = null

  // 1) A single line "… V …" — take the last one, since the teams follow the preamble
  for (let i = lines.length - 1; i >= 0 && !sideA; i--) {
    if (LIST_ITEM.test(lines[i])) continue
    const parts = lines[i].split(VERSUS)
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) [sideA, sideB] = parts
  }

  // 2) Teams on separate lines with a lone "v" between them
  if (!sideA) {
    const at = lines.findLastIndex((l) => LONE_VERSUS.test(l))
    if (at > 0) {
      const block = (from, step) => {
        const out = []
        for (let i = from; i >= 0 && i < lines.length && lines[i]; i += step) out.push(lines[i])
        return (step < 0 ? out.reverse() : out).join('\n')
      }
      const skipBlank = (i, step) => { while (lines[i] === '') i += step; return i }
      sideA = block(skipBlank(at - 1, -1), -1)
      sideB = block(skipBlank(at + 1, 1), 1)
    }
  }

  if (!sideA || !sideB) {
    return { ok: false, error: 'Couldn’t find the teams. Look for a line like “Ali Omar Tony V Matt Jaz Sean” in the message.' }
  }

  const resolve = (side) => splitNames(side, knownNames).map((raw) => ({ raw, ...matchPlayer(raw, players) }))
  const teamA = resolve(sideA)
  const teamB = resolve(sideB)
  if (teamA.length === 0 || teamB.length === 0) return { ok: false, error: 'One of the teams came out empty. Check the message and try again.' }
  return { ok: true, teamA, teamB }
}
