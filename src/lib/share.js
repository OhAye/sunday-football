// WhatsApp share helpers. Message builders are pure; openers deal with popup blocking.
import { APP_NAME } from './constants'
import { fmtDate } from './format'
import { motmIdsOf } from './stats'

const waUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`

export function openWhatsApp(text) {
  window.open(waUrl(text), '_blank', 'noopener')
}

// For shares that need async work first (e.g. saving the vote). iOS Safari blocks window.open
// after an await, so the tab is opened synchronously and pointed at WhatsApp once ready.
export async function openWhatsAppAfter(buildText) {
  const tab = window.open('', '_blank')
  try {
    const text = await buildText()
    if (!text) { tab?.close(); return false }
    if (tab) tab.location.href = waUrl(text)
    else window.location.href = waUrl(text)
    return true
  } catch (err) {
    tab?.close()
    throw err
  }
}

const scoreLine = (session) =>
  session.result && session.result.scoreKnown !== false
    ? `Team A ${session.result.scoreA} – ${session.result.scoreB} Team B`
    : null

export function voteUrl(sessionId) {
  return `${window.location.href.replace(/#.*$/, '')}#/vote/${sessionId}`
}

export function lineupText(session, nameOf) {
  const teamA = session.teams.teamA.map(nameOf).join(', ')
  const teamB = session.teams.teamB.map(nameOf).join(', ')
  return [
    `⚽ ${APP_NAME} — ${fmtDate(session.date)}`,
    '',
    `🟢 Team A: ${teamA}`,
    '',
    `🔵 Team B: ${teamB}`,
  ].join('\n')
}

export function voteText(session) {
  const score = scoreLine(session)
  return [
    `⭐ MOTM Vote — ${APP_NAME} ⭐`,
    '',
    `📅 ${fmtDate(session.date)}`,
    ...(score ? [`⚽ ${score}`] : []),
    '',
    'Vote for your Man of the Match:',
    voteUrl(session.id),
  ].join('\n')
}

export function motmResultText(session, nameOf) {
  const names = motmIdsOf(session).map(nameOf).filter(Boolean)
  if (!names.length) return null
  const nameStr = names.join(' & ')
  const score = scoreLine(session)
  return [
    `⭐ Man of the Match — ${APP_NAME} ⭐`,
    '',
    `📅 ${fmtDate(session.date)}`,
    ...(score ? [`⚽ ${score}`] : []),
    '',
    `🏆 ${names.length > 1 ? 'Joint ' : ''}MOTM: ${nameStr}`,
    '',
    `Congrats ${nameStr}! 👏`,
  ].join('\n')
}

export { scoreLine }
