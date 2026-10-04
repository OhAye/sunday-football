// Historical match-day weather from Open-Meteo (free, no API key).
import { PITCH_LOCATION } from './constants'

export async function fetchWeatherForDate(date) {
  try {
    const { latitude, longitude } = PITCH_LOCATION
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
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
      tempC: Math.round((maxT + (minT ?? maxT)) / 2),
      windKph: Math.round(wind ?? 0),
    }
  } catch {
    return null
  }
}
