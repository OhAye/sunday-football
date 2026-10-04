import { createContext, useContext, useEffect, useState } from 'react'
import { historicalSessions } from '../data/historicalSessions'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

// ─── DB mapping helpers ──────────────────────────────────────────
function sessionToDb(s) {
  return {
    id: s.id,
    date: s.date,
    player_ids: s.playerIds ?? [],
    teams: s.teams ?? null,
    result: s.result ?? null,
    motm: s.motm ?? null,           // TEXT[] in DB
    report: s.report ?? null,
    weather: s.weather ?? null,     // JSONB { code, tempC, windKph }
    written_by: s.writtenBy ?? null,
    created_at: s.createdAt ?? new Date().toISOString(),
  }
}

// Usman G joined later; bare 'h-usman' (pre-distinction) belongs to Usman A
function remapPlayerId(id) {
  return id === 'h-usman' ? 'h-usmana' : id
}

function dbToSession(row) {
  const teams = row.teams
    ? {
        teamA: (row.teams.teamA ?? []).map(remapPlayerId),
        teamB: (row.teams.teamB ?? []).map(remapPlayerId),
        ...(row.teams.format ? { format: row.teams.format } : {}),
      }
    : null
  // Handle legacy single-string motm and new TEXT[] format
  let motm = null
  if (Array.isArray(row.motm)) {
    motm = row.motm.map(remapPlayerId)
  } else if (row.motm) {
    motm = [remapPlayerId(row.motm)]
  }
  return {
    id: row.id,
    date: row.date,
    playerIds: (row.player_ids ?? []).map(remapPlayerId),
    teams,
    result: row.result,
    motm,                               // string[] | null
    report: row.report ?? null,
    weather: row.weather ?? null,       // { code, tempC, windKph } | null
    writtenBy: row.written_by ?? null,  // player ID | null
    createdAt: row.created_at,
  }
}

// ─── Open-Meteo weather fetch (Townhead Power League, Glasgow) ────
async function fetchWeatherForDate(date) {
  try {
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=55.8636&longitude=-4.2378` +
      `&start_date=${date}&end_date=${date}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max` +
      `&timezone=Europe%2FLondon`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const code = data.daily?.weathercode?.[0]
    const maxT = data.daily?.temperature_2m_max?.[0]
    const minT = data.daily?.temperature_2m_min?.[0]
    const wind = data.daily?.windspeed_10m_max?.[0]
    if (code == null || maxT == null) return null
    return {
      code,
      tempC: Math.round((maxT + minT) / 2),
      windKph: Math.round(wind ?? 0),
    }
  } catch {
    return null
  }
}

// legacyPlayed/Wins/Losses/Draws = Oct 2024–Feb 2026 WhatsApp records
// legacyGoals/legacyMotm = all-time historical records
// estimated: true = derived from match reports (not fully verified)
const initialPlayers = [
  // Per-year P/W/L from WhatsApp records (draws folded into losses). All-time = sum of years.
  // legacyMotm broken down by year from MOTM spreadsheet.
  //                                                                                                        ── all time ──────────────────────  ── 2024 ────────────  ── 2025 ─────────────  ── 2026 ────────────
  { id: 'h-omar',    name: 'Omar',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 22, legacyMotm2024: 7,  legacyMotm2025: 4,  legacyMotm2026: 1, legacyPlayed: 38, legacyWins: 19, legacyLosses: 19, legacyDraws: 0, legacyGoals: 87, legacyPlayed2024: 8,  legacyWins2024: 5,  legacyLosses2024: 3,  legacyPlayed2025: 26, legacyWins2025: 12, legacyLosses2025: 14, legacyPlayed2026: 4,  legacyWins2026: 2,  legacyLosses2026: 2,  estimated: true  },
  { id: 'h-tommy',   name: 'Tommy',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 9,  legacyMotm2024: 4,  legacyMotm2025: 3,  legacyMotm2026: 1, legacyPlayed: 33, legacyWins: 16, legacyLosses: 17, legacyDraws: 0, legacyGoals: 90, legacyPlayed2024: 8,  legacyWins2024: 4,  legacyLosses2024: 4,  legacyPlayed2025: 20, legacyWins2025: 10, legacyLosses2025: 10, legacyPlayed2026: 5,  legacyWins2026: 2,  legacyLosses2026: 3,  estimated: true  },
  { id: 'h-jonny',   name: 'Jonny',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 1, legacyPlayed: 10, legacyWins: 5,  legacyLosses: 5,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 6,  legacyWins2025: 3,  legacyLosses2025: 3,  legacyPlayed2026: 4,  legacyWins2026: 2,  legacyLosses2026: 2,  estimated: false },
  { id: 'h-ranj',    name: 'Ranj',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 1, legacyPlayed: 9,  legacyWins: 4,  legacyLosses: 5,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 5,  legacyWins2025: 1,  legacyLosses2025: 4,  legacyPlayed2026: 4,  legacyWins2026: 3,  legacyLosses2026: 1,  estimated: false },
  { id: 'h-zack',    name: 'Zack',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 3,  legacyMotm2024: 2,  legacyMotm2025: 0,  legacyMotm2026: 1, legacyPlayed: 10, legacyWins: 6,  legacyLosses: 4,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 4,  legacyWins2025: 2,  legacyLosses2025: 2,  legacyPlayed2026: 6,  legacyWins2026: 4,  legacyLosses2026: 2,  estimated: false },
  { id: 'h-daniyal', name: 'Daniyal', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 1, legacyPlayed: 11, legacyWins: 4,  legacyLosses: 7,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 7,  legacyWins2025: 2,  legacyLosses2025: 5,  legacyPlayed2026: 4,  legacyWins2026: 2,  legacyLosses2026: 2,  estimated: true  },
  { id: 'h-matt',    name: 'Matt',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 22, legacyMotm2024: 8,  legacyMotm2025: 9,  legacyMotm2026: 0, legacyPlayed: 22, legacyWins: 10, legacyLosses: 12, legacyDraws: 0, legacyGoals: 67, legacyPlayed2024: 3,  legacyWins2024: 0,  legacyLosses2024: 3,  legacyPlayed2025: 14, legacyWins2025: 9,  legacyLosses2025: 5,  legacyPlayed2026: 5,  legacyWins2026: 1,  legacyLosses2026: 4,  estimated: true  },
  { id: 'h-zeshan',  name: 'Zeshan',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 15, legacyMotm2024: 6,  legacyMotm2025: 5,  legacyMotm2026: 0, legacyPlayed: 33, legacyWins: 13, legacyLosses: 20, legacyDraws: 0, legacyGoals: 81, legacyPlayed2024: 8,  legacyWins2024: 3,  legacyLosses2024: 5,  legacyPlayed2025: 22, legacyWins2025: 8,  legacyLosses2025: 14, legacyPlayed2026: 3,  legacyWins2026: 2,  legacyLosses2026: 1,  estimated: true  },
  { id: 'h-tony',    name: 'Tony',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 8,  legacyMotm2024: 4,  legacyMotm2025: 4,  legacyMotm2026: 0, legacyPlayed: 17, legacyWins: 9,  legacyLosses: 8,  legacyDraws: 0, legacyGoals: 67, legacyPlayed2024: 8,  legacyWins2024: 5,  legacyLosses2024: 3,  legacyPlayed2025: 9,  legacyWins2025: 4,  legacyLosses2025: 5,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-shez',    name: 'Shez',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 9,  legacyMotm2024: 4,  legacyMotm2025: 4,  legacyMotm2026: 0, legacyPlayed: 39, legacyWins: 19, legacyLosses: 20, legacyDraws: 0, legacyGoals: 86, legacyPlayed2024: 8,  legacyWins2024: 4,  legacyLosses2024: 4,  legacyPlayed2025: 25, legacyWins2025: 12, legacyLosses2025: 13, legacyPlayed2026: 6,  legacyWins2026: 3,  legacyLosses2026: 3,  estimated: true  },
  { id: 'h-ali',     name: 'Ali',     position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 3,  legacyMotm2024: 0,  legacyMotm2025: 3,  legacyMotm2026: 0, legacyPlayed: 30, legacyWins: 10, legacyLosses: 20, legacyDraws: 0, legacyGoals: 81, legacyPlayed2024: 7,  legacyWins2024: 2,  legacyLosses2024: 5,  legacyPlayed2025: 19, legacyWins2025: 6,  legacyLosses2025: 13, legacyPlayed2026: 4,  legacyWins2026: 2,  legacyLosses2026: 2,  estimated: true  },
  { id: 'h-james',   name: 'James',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 3,  legacyMotm2024: 1,  legacyMotm2025: 2,  legacyMotm2026: 0, legacyPlayed: 18, legacyWins: 8,  legacyLosses: 10, legacyDraws: 0, legacyGoals: 36, legacyPlayed2024: 1,  legacyWins2024: 0,  legacyLosses2024: 1,  legacyPlayed2025: 16, legacyWins2025: 8,  legacyLosses2025: 8,  legacyPlayed2026: 1,  legacyWins2026: 0,  legacyLosses2026: 1,  estimated: false },
  { id: 'h-lewis',   name: 'Lewis',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 0,  legacyMotm2025: 2,  legacyMotm2026: 0, legacyPlayed: 13, legacyWins: 7,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-saqa',    name: 'Saq A',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 1,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 44, legacyWins: 19, legacyLosses: 25, legacyDraws: 0, legacyGoals: 59, legacyPlayed2024: 11, legacyWins2024: 4,  legacyLosses2024: 7,  legacyPlayed2025: 29, legacyWins2025: 14, legacyLosses2025: 15, legacyPlayed2026: 4,  legacyWins2026: 1,  legacyLosses2026: 3,  estimated: false },
  { id: 'h-immy',    name: 'Immy',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 11, legacyWins: 5,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 28, legacyPlayed2024: 4,  legacyWins2024: 3,  legacyLosses2024: 1,  legacyPlayed2025: 7,  legacyWins2025: 2,  legacyLosses2025: 5,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-scott',   name: 'Scott',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 4,  legacyMotm2024: 1,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-sean',    name: 'Sean',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 1,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 10, legacyWins: 4,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 6,  legacyWins2025: 1,  legacyLosses2025: 5,  legacyPlayed2026: 4,  legacyWins2026: 3,  legacyLosses2026: 1,  estimated: true  },
  { id: 'h-raza',    name: 'Raza',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 5,  legacyMotm2024: 1,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 14, legacyWins: 8,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 39, legacyPlayed2024: 1,  legacyWins2024: 1,  legacyLosses2024: 0,  legacyPlayed2025: 13, legacyWins2025: 7,  legacyLosses2025: 6,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-billy',   name: 'Billy',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 4,  legacyMotm2024: 2,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 23, legacyWins: 11, legacyLosses: 12, legacyDraws: 0, legacyGoals: 25, legacyPlayed2024: 5,  legacyWins2024: 1,  legacyLosses2024: 4,  legacyPlayed2025: 15, legacyWins2025: 9,  legacyLosses2025: 6,  legacyPlayed2026: 3,  legacyWins2026: 1,  legacyLosses2026: 2,  estimated: true  },
  { id: 'h-saqy',    name: 'Saq Y',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 6,  legacyMotm2024: 3,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 28, legacyWins: 9,  legacyLosses: 19, legacyDraws: 0, legacyGoals: 47, legacyPlayed2024: 5,  legacyWins2024: 0,  legacyLosses2024: 5,  legacyPlayed2025: 19, legacyWins2025: 8,  legacyLosses2025: 11, legacyPlayed2026: 4,  legacyWins2026: 1,  legacyLosses2026: 3,  estimated: true  },
  { id: 'h-morteza', name: 'Morteza', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 6,  legacyMotm2024: 1,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-mandip',  name: 'Mandip',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-emre',    name: 'Emre',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-hammad',  name: 'Hammad',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-xander',  name: 'Xander',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 1,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-stephen', name: 'Stephen', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-burhan',  name: 'Burhan',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 6,  legacyMotm2024: 5,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 12, legacyWins: 3,  legacyLosses: 9,  legacyDraws: 0, legacyGoals: 10, legacyPlayed2024: 5,  legacyWins2024: 1,  legacyLosses2024: 4,  legacyPlayed2025: 7,  legacyWins2025: 2,  legacyLosses2025: 5,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-dal',     name: 'Dal',     position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 5,  legacyMotm2024: 2,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 12, legacyWins: 2,  legacyLosses: 10, legacyDraws: 0, legacyGoals: 27, legacyPlayed2024: 4,  legacyWins2024: 0,  legacyLosses2024: 4,  legacyPlayed2025: 8,  legacyWins2025: 2,  legacyLosses2025: 6,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-shan',    name: 'Shan',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 23, legacyWins: 10, legacyLosses: 13, legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: true  },
  { id: 'h-chris',   name: 'Chris',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 1,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-rory',    name: 'Rory',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 9,  legacyWins: 3,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 6,  legacyWins2025: 2,  legacyLosses2025: 4,  legacyPlayed2026: 3,  legacyWins2026: 1,  legacyLosses2026: 2,  estimated: false },
  { id: 'h-aquib',   name: 'Aquib',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 2,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-jamie',   name: 'Jamie',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 1,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-usmana',  name: 'Usman A', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 26, legacyWins: 5,  legacyLosses: 21, legacyDraws: 0, legacyGoals: 51, legacyPlayed2024: 2,  legacyWins2024: 1,  legacyLosses2024: 1,  legacyPlayed2025: 19, legacyWins2025: 3,  legacyLosses2025: 16, legacyPlayed2026: 5,  legacyWins2026: 1,  legacyLosses2026: 4,  estimated: true  },
  { id: 'h-usmang',  name: 'Usman G', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 38, legacyWins: 21, legacyLosses: 17, legacyDraws: 0, legacyGoals: 64, legacyPlayed2024: 5,  legacyWins2024: 2,  legacyLosses2024: 3,  legacyPlayed2025: 27, legacyWins2025: 15, legacyLosses2025: 12, legacyPlayed2026: 6,  legacyWins2026: 4,  legacyLosses2026: 2,  estimated: true  },
  { id: 'h-jaz',     name: 'Jaz',     position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 9,  legacyWins: 3,  legacyLosses: 6,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 6,  legacyWins2025: 1,  legacyLosses2025: 5,  legacyPlayed2026: 3,  legacyWins2026: 2,  legacyLosses2026: 1,  estimated: false },
  { id: 'h-harris',  name: 'Harris',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-tamer',   name: 'Tamer',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-samir',   name: 'Samir',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-hanzala', name: 'Hanzala', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-petar',   name: 'Petar',   position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-taimoor', name: 'Taimoor', position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-dee',     name: 'Dee',     position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-amin',    name: 'Amin',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-shabaz',  name: 'Shabaz',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-kris',    name: 'Kris',    position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-hanaan',  name: 'Hanaan',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-aki',     name: 'Aki',     position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-darren',  name: 'Darren',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
  { id: 'h-jibran',  name: 'Jibran',  position: 'MID', number: null, createdAt: '2023-01-01T00:00:00.000Z', legacyMotm: 0,  legacyMotm2024: 0,  legacyMotm2025: 0,  legacyMotm2026: 0, legacyPlayed: 0,  legacyWins: 0,  legacyLosses: 0,  legacyDraws: 0, legacyGoals: 0,  legacyPlayed2024: 0,  legacyWins2024: 0,  legacyLosses2024: 0,  legacyPlayed2025: 0,  legacyWins2025: 0,  legacyLosses2025: 0,  legacyPlayed2026: 0,  legacyWins2026: 0,  legacyLosses2026: 0,  estimated: false },
]

// Run all legacy migration phases on a players array (used when seeding from localStorage → Supabase)
function migratePlayers(source) {
  const newPlayerIds = ['h-harris','h-tamer','h-samir','h-hanzala','h-petar','h-taimoor','h-dee','h-amin','h-shabaz','h-kris','h-hanaan','h-aki','h-darren','h-jibran']

  let updated = source.map((p) => {
    let next = p
    const seed = initialPlayers.find((ip) => ip.id === next.id)
    if (next.legacyLosses === undefined) {
      next = { ...next, legacyPlayed: seed?.legacyPlayed ?? next.legacyPlayed, legacyWins: seed?.legacyWins ?? next.legacyWins, legacyLosses: seed?.legacyLosses ?? 0, legacyDraws: seed?.legacyDraws ?? 0, estimated: seed?.estimated ?? false }
    }
    if (next.legacyMotm2024 === undefined) {
      next = { ...next, legacyMotm2024: seed?.legacyMotm2024 ?? 0, legacyMotm2025: seed?.legacyMotm2025 ?? 0, legacyMotm2026: seed?.legacyMotm2026 ?? 0 }
    }
    if (next.legacyPlayed2024 === undefined) {
      next = { ...next, legacyPlayed2024: seed?.legacyPlayed2024 ?? 0, legacyWins2024: seed?.legacyWins2024 ?? 0, legacyLosses2024: seed?.legacyLosses2024 ?? 0, legacyPlayed2025: seed?.legacyPlayed2025 ?? 0, legacyWins2025: seed?.legacyWins2025 ?? 0, legacyLosses2025: seed?.legacyLosses2025 ?? 0, legacyPlayed2026: seed?.legacyPlayed2026 ?? 0, legacyWins2026: seed?.legacyWins2026 ?? 0, legacyLosses2026: seed?.legacyLosses2026 ?? 0 }
    }
    if ((next.legacyDraws ?? 0) > 0) {
      next = { ...next, legacyLosses: (next.legacyLosses ?? 0) + (next.legacyDraws ?? 0), legacyDraws: 0 }
    }
    if ((next.legacyPlayed ?? 0) > 0) {
      next = { ...next, legacyPlayed: 0, legacyWins: 0, legacyLosses: 0, legacyDraws: 0, legacyPlayed2024: 0, legacyWins2024: 0, legacyLosses2024: 0, legacyPlayed2025: 0, legacyWins2025: 0, legacyLosses2025: 0, legacyPlayed2026: 0, legacyWins2026: 0, legacyLosses2026: 0 }
    }
    const CORRECTIONS_2025 = {
      'h-ali':    { legacyWins2025: 4 },
      'h-burhan': { legacyPlayed2025: 1 },
      'h-immy':   { legacyPlayed2025: 1, legacyWins2025: 1 },
      'h-james':  { legacyPlayed2025: 2 },
      'h-matt':   { legacyPlayed2025: 3, legacyWins2025: 2 },
      'h-omar':   { legacyPlayed2025: 1, legacyWins2025: 1 },
      'h-saqa':   { legacyPlayed2025: 3, legacyWins2025: 2 },
      'h-saqy':   { legacyPlayed2025: 1, legacyWins2025: 3 },
      'h-tommy':  { legacyPlayed2025: 2, legacyWins2025: 1 },
      'h-tony':   { legacyPlayed2025: 1, legacyWins2025: 3 },
      // Usman A: sessions already give 33p/11w → no legacy needed
      // Usman G: sessions give 41p/17w but true 2025 total is 34p/12w → offset by -7/-5
      'h-usmang': { legacyPlayed2025: -7, legacyWins2025: -5 },
      'h-zeshan': { legacyPlayed2025: 1, legacyWins2025: 1 },
    }
    if (CORRECTIONS_2025[next.id]) next = { ...next, ...CORRECTIONS_2025[next.id] }
    return next
  })

  // Add missing players
  for (const id of ['h-shan', 'h-jaz', ...newPlayerIds]) {
    if (!updated.some((p) => p.id === id)) {
      const newP = initialPlayers.find((p) => p.id === id)
      if (newP) updated.push(newP)
    }
  }

  return updated
}

export function AppProvider({ children }) {
  const [players, setPlayers] = useState([])
  const [playersLoaded, setPlayersLoaded] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [adminPin, setAdminPin] = useState(null) // loaded from Supabase
  const [isAdmin, setIsAdmin] = useState(false)

  // ── Load admin PIN from Supabase ──
  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_pin')
      .single()
      .then(({ data }) => {
        if (data?.value) setAdminPin(data.value)
      })
  }, [])

  // ── Load players from Supabase (seed from localStorage or initialPlayers on first run) ──
  useEffect(() => {
    async function loadPlayers() {
      const { data: existing, error } = await supabase
        .from('players')
        .select('*')

      if (error) {
        console.error('Failed to load players:', error)
        setPlayers(initialPlayers)
        setPlayersLoaded(true)
        return
      }

      if (existing.length > 0) {
        // Drop bare 'h-usman' row if present — Usman A (h-usmana) is the correct entry
        setPlayers(existing.map((r) => r.data).filter((p) => p.id !== 'h-usman'))
        setPlayersLoaded(true)
        return
      }

      // Supabase is empty — seed from localStorage (preserves custom positions/edits) or initialPlayers
      const localRaw = localStorage.getItem('sf_players')
      const source = localRaw ? JSON.parse(localRaw) : initialPlayers
      const migrated = migratePlayers(source)

      const { error: insertError } = await supabase
        .from('players')
        .insert(migrated.map((p) => ({ id: p.id, data: p })))

      if (!insertError) {
        localStorage.removeItem('sf_players')
      } else {
        console.error('Failed to seed players to Supabase:', insertError)
      }

      setPlayers(migrated)
      setPlayersLoaded(true)
    }
    loadPlayers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load sessions from Supabase (seed from localStorage or historicalSessions on first run) ──
  useEffect(() => {
    async function loadSessions() {
      const { data: existing, error } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('Failed to load sessions:', error)
        setSessionsLoaded(true)
        return
      }

      if (existing.length > 0) {
        setSessions(existing.map(dbToSession))
        setSessionsLoaded(true)
        return
      }

      // Supabase is empty — seed from localStorage data (preserves any manual admin edits) or historicalSessions
      const localRaw = localStorage.getItem('sf_sessions')
      let source = localRaw ? JSON.parse(localRaw) : historicalSessions

      // Apply Phase 6 fixes in-memory (partial lineup sessions)
      const SESSION_FIXES = {
        '97901eeb-1a20-40fb-a9ce-a2b83b149d2d': {
          playerIds: ['h-ali', 'h-usmang', 'h-shez', 'h-zeshan', 'h-raza'],
          teams: { teamA: ['h-ali', 'h-usmang'], teamB: ['h-shez', 'h-zeshan', 'h-raza'] },
        },
        '21becac1-f819-43cd-9a46-589798f42a8b': {
          playerIds: ['h-shez', 'h-ali', 'h-tommy', 'h-emre', 'h-shabaz', 'h-tony', 'h-omar', 'h-saqa', 'h-saqy'],
          teams: { teamA: ['h-shez', 'h-ali', 'h-tommy', 'h-emre', 'h-shabaz', 'h-tony'], teamB: ['h-omar', 'h-saqa', 'h-saqy'] },
        },
        'ff271829-48bc-4348-8d70-0b0b2e45f0e2': {
          playerIds: ['h-shez', 'h-ali', 'h-tommy', 'h-matt', 'h-zeshan', 'h-omar'],
          teams: { teamA: ['h-shez', 'h-ali', 'h-tommy', 'h-matt'], teamB: ['h-zeshan', 'h-omar'] },
        },
      }
      source = source.map((s) => {
        const fix = SESSION_FIXES[s.id]
        if (fix && (s.playerIds?.length ?? 0) < fix.playerIds.length) {
          return { ...s, playerIds: fix.playerIds, teams: fix.teams }
        }
        return s
      })

      // Apply scoreKnown backfill
      source = source.map((s) => {
        if (!s.result || s.result.scoreKnown !== undefined) return s
        const { scoreA, scoreB } = s.result
        return { ...s, result: { ...s.result, scoreKnown: (scoreA + scoreB) > 1 } }
      })

      source = source.sort((a, b) => b.date.localeCompare(a.date))

      const { error: insertError } = await supabase
        .from('sessions')
        .insert(source.map(sessionToDb))

      if (!insertError) {
        localStorage.removeItem('sf_sessions')
      } else {
        console.error('Failed to seed sessions to Supabase:', insertError)
      }
      setSessions(source)
      setSessionsLoaded(true)
    }
    loadSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addPlayer({ name, position, number }) {
    const player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      position: position ?? 'MID',
      number: number ? Number(number) : null,
      createdAt: new Date().toISOString(),
      legacyMotm: 0,
    }
    const { error } = await supabase.from('players').insert({ id: player.id, data: player })
    if (!error) setPlayers((prev) => [...prev, player])
    return player
  }

  async function updatePlayer(id, updates) {
    const current = players.find((p) => p.id === id)
    if (!current) return
    const updated = { ...current, ...updates }
    await supabase.from('players').update({ data: updated }).eq('id', id)
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  async function removePlayer(id) {
    await supabase.from('players').delete().eq('id', id)
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  async function addSession(date, playerIds) {
    const session = {
      id: crypto.randomUUID(),
      date,
      playerIds,
      teams: null,
      result: null,
      createdAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('sessions').insert(sessionToDb(session))
    if (!error) setSessions((prev) => [session, ...prev])
    return session
  }

  async function saveMatch({ date, teamA, teamB, scoreA, scoreB, format = 7 }) {
    const playerIds = [...new Set([...teamA, ...teamB])]
    const hasScore = scoreA !== '' && scoreB !== '' && scoreA != null && scoreB != null
    const session = {
      id: crypto.randomUUID(),
      date,
      playerIds,
      teams: { teamA, teamB, format },
      result: hasScore ? { scoreA: Number(scoreA), scoreB: Number(scoreB), scoreKnown: true } : null,
      weather: null,
      createdAt: new Date().toISOString(),
    }
    if (session.result) {
      session.weather = await fetchWeatherForDate(date)
    }
    const { error } = await supabase.from('sessions').insert(sessionToDb(session))
    if (!error) setSessions((prev) => [session, ...prev])
    return session
  }

  async function updateSession(id, updates) {
    const current = sessions.find((s) => s.id === id)
    if (!current) return
    const merged = { ...current, ...updates }
    // Auto-fetch weather when result is first saved and no weather stored yet
    if (updates.result && !current.weather && !merged.weather) {
      merged.weather = await fetchWeatherForDate(merged.date)
    }
    const { error } = await supabase.from('sessions').update(sessionToDb(merged)).eq('id', id)
    if (!error) setSessions((prev) => prev.map((s) => (s.id === id ? merged : s)))
  }

  async function removeSession(id) {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (!error) setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  async function importHistoricalSessions() {
    const { data: existing } = await supabase.from('sessions').select('date')
    const existingDates = new Set((existing ?? []).map((r) => r.date))
    const toAdd = historicalSessions.filter((s) => !existingDates.has(s.date))
    if (toAdd.length > 0) {
      const { error } = await supabase.from('sessions').insert(toAdd.map(sessionToDb))
      if (!error) {
        setSessions((prev) => [...prev, ...toAdd].sort((a, b) => b.date.localeCompare(a.date)))
      }
    }
    // Zero out legacy W/L/played (sessions now cover that period); keep MOTM + Goals
    const updatedPlayers = players.map((p) => ({
      ...p,
      legacyPlayed: 0, legacyWins: 0, legacyLosses: 0, legacyDraws: 0,
      legacyPlayed2024: 0, legacyWins2024: 0, legacyLosses2024: 0,
      legacyPlayed2025: 0, legacyWins2025: 0, legacyLosses2025: 0,
      legacyPlayed2026: 0, legacyWins2026: 0, legacyLosses2026: 0,
    }))
    await supabase.from('players').upsert(updatedPlayers.map((p) => ({ id: p.id, data: p })))
    setPlayers(updatedPlayers)
  }

  function unlockAdmin(pin) {
    if (adminPin !== null && pin === adminPin) { setIsAdmin(true); return true }
    return false
  }
  function lockAdmin() { setIsAdmin(false) }
  async function changePin(newPin) {
    await supabase
      .from('settings')
      .update({ value: newPin })
      .eq('key', 'admin_pin')
    setAdminPin(newPin)
  }

  // Exclude 2024 sessions — data is inaccurate; only 2025+ is used for stats
  const visibleSessions = sessions.filter((s) => !s.date?.startsWith('2024'))

  function getMotmCount(playerId, year = null) {
    const sessionCount = visibleSessions.filter((s) => {
      const ids = Array.isArray(s.motm) ? s.motm : (s.motm ? [s.motm] : [])
      if (!ids.includes(playerId)) return false
      if (year !== null && !s.date?.startsWith(year)) return false
      return true
    }).length
    const player = players.find((p) => p.id === playerId)
    if (year !== null) {
      const legacyForYear = player?.[`legacyMotm${year}`] ?? 0
      return sessionCount + legacyForYear
    }
    return sessionCount + (player?.legacyMotm ?? 0)
  }

  function getPlayerStats(playerId, year = null) {
    const played = visibleSessions.filter((s) => {
      if (!s.playerIds.includes(playerId)) return false
      if (year !== null && !s.date?.startsWith(year)) return false
      return true
    })
    let wins = 0, draws = 0, losses = 0

    for (const session of played) {
      if (!session.result || !session.teams) continue
      const inTeamA = session.teams.teamA.includes(playerId)
      const inTeamB = session.teams.teamB.includes(playerId)
      const { scoreA, scoreB } = session.result
      if (inTeamA) {
        if (scoreA > scoreB) wins++
        else if (scoreA === scoreB) draws++
        else losses++
      } else if (inTeamB) {
        if (scoreB > scoreA) wins++
        else if (scoreB === scoreA) draws++
        else losses++
      }
    }

    // Season view: session data + per-year legacy fields
    const player = players.find((p) => p.id === playerId)
    if (year !== null) {
      const legacyPlayed = player?.[`legacyPlayed${year}`] ?? 0
      const legacyWins   = player?.[`legacyWins${year}`]   ?? 0
      const totalPlayed  = played.length + legacyPlayed
      const totalWins    = wins + legacyWins
      return {
        played: totalPlayed,
        wins:   totalWins,
        draws,
        losses: Math.max(0, totalPlayed - totalWins - draws),
      }
    }

    // All time: sum per-year legacy fields so numbers match the sum of all seasons
    // 2024 legacy fields and 2024 sessions excluded (data was inaccurate)
    const legacyPlayedTotal = (player?.legacyPlayed   ?? 0) + (player?.legacyPlayed2025 ?? 0) + (player?.legacyPlayed2026 ?? 0)
    const legacyWinsTotal   = (player?.legacyWins     ?? 0) + (player?.legacyWins2025   ?? 0) + (player?.legacyWins2026   ?? 0)
    const legacyLossesTotal = (player?.legacyLosses   ?? 0) + (player?.legacyLosses2025 ?? 0) + (player?.legacyLosses2026 ?? 0)
    const totalPlayed = played.length + legacyPlayedTotal
    const totalWins   = wins   + legacyWinsTotal
    const totalDraws  = draws  + (player?.legacyDraws ?? 0)
    const totalLosses = legacyLossesTotal > 0
      ? losses + legacyLossesTotal
      : totalPlayed - totalWins - totalDraws
    return {
      played: totalPlayed,
      wins:   totalWins,
      draws:  totalDraws,
      losses: totalLosses,
    }
  }

  // Win/loss streak for a player in the current calendar year.
  // Computed from session history in chronological order.
  // A draw resets both streaks to zero.
  function getStreaks(playerId) {
    const currentYear = new Date().getFullYear().toString()
    const yearSessions = visibleSessions
      .filter((s) => s.date?.startsWith(currentYear) && s.result && s.teams)
      .sort((a, b) => a.date.localeCompare(b.date))
    let winStreak = 0
    let lossStreak = 0
    for (const s of yearSessions) {
      const inA = s.teams.teamA.includes(playerId)
      const inB = s.teams.teamB.includes(playerId)
      if (!inA && !inB) continue
      const { scoreA, scoreB } = s.result
      const won  = inA ? scoreA > scoreB : scoreB > scoreA
      const lost = inA ? scoreA < scoreB : scoreB < scoreA
      if (won)       { winStreak++;  lossStreak = 0 }
      else if (lost) { lossStreak++; winStreak  = 0 }
      else           { winStreak = 0; lossStreak = 0 }
    }
    return { winStreak, lossStreak }
  }

  // Attendance rate for a player. If year is provided, scoped to that year;
  // otherwise all-time since debut. Returns rate (%), played, totalSince, last-10 dot data.
  function getAttendance(playerId, year = null) {
    const pool = year ? visibleSessions.filter((s) => s.date?.startsWith(year)) : visibleSessions
    const playerSessions = pool.filter((s) => s.playerIds.includes(playerId))
    if (playerSessions.length === 0) return { rate: null, played: 0, totalSince: 0, last10: [] }
    const sessionsSince = year ? pool : (() => {
      const firstDate = playerSessions.reduce((min, s) => s.date < min ? s.date : min, playerSessions[0].date)
      return pool.filter((s) => s.date >= firstDate)
    })()
    const rate = sessionsSince.length > 0 ? Math.round((playerSessions.length / sessionsSince.length) * 100) : null
    const last10 = [...sessionsSince]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((s) => {
        const played = s.playerIds.includes(playerId)
        let result = null
        if (played && s.result && s.teams) {
          const inA = s.teams.teamA.includes(playerId)
          const { scoreA, scoreB } = s.result
          const won  = inA ? scoreA > scoreB : scoreB > scoreA
          const lost = inA ? scoreA < scoreB : scoreB < scoreA
          result = won ? 'W' : lost ? 'L' : 'D'
        }
        return { date: s.date, played, result }
      })
    return { rate, played: playerSessions.length, totalSince: sessionsSince.length, last10 }
  }

  return (
    <AppContext.Provider
      value={{
        players,
        sessions: visibleSessions,
        sessionsLoaded: sessionsLoaded && playersLoaded,
        isAdmin,
        unlockAdmin,
        lockAdmin,
        changePin,
        addPlayer,
        updatePlayer,
        removePlayer,
        addSession,
        saveMatch,
        updateSession,
        removeSession,
        importHistoricalSessions,
        fetchWeatherForDate,
        getMotmCount,
        getPlayerStats,
        getStreaks,
        getAttendance,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
