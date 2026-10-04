import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { todayYMD } from '../lib/format'
import { EmptyState, Loading, PageHeader, Pills } from '../components/ui'
import { PlusIcon } from '../components/icons'
import MatchCard from '../components/match/MatchCard'

const PAGE_SIZE = 8

// Games tab: upcoming fixtures first, then results by season.
export default function Lineups() {
  const { sessions, sessionsLoaded } = useApp()
  const navigate = useNavigate()
  const [year, setYear] = useState(null) // null = most recent season
  const [shown, setShown] = useState(PAGE_SIZE)

  if (!sessionsLoaded) return <Loading />

  const today = todayYMD()
  const upcoming = sessions.filter((s) => !s.result && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = sessions.filter((s) => s.result || s.date < today) // newest first
  const years = [...new Set(past.map((s) => s.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
  const activeYear = year ?? years[0]
  const seasonGames = past.filter((s) => s.date.startsWith(activeYear))
  const edit = (id) => navigate(`/lineups/${id}/edit`)

  return (
    <div className="flex flex-col">
      <PageHeader
        kicker="Matches"
        title="Games"
        action={
          <Link to="/lineups/new" className="btn btn-primary">
            <PlusIcon className="w-4 h-4" strokeWidth={2.4} /> New
          </Link>
        }
      />

      <div className="space-y-6 px-4">
        {sessions.length === 0 && (
          <EmptyState
            title="No matches yet"
            body="Pick teams with the balancer, or set a lineup by hand."
            action={<Link to="/balance" className="btn btn-primary">Pick teams</Link>}
          />
        )}

        {upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="eyebrow flex items-center gap-2 text-amber">
              <span className="live-dot h-2 w-2 rounded-full bg-amber" /> Up next
            </h2>
            {upcoming.map((s) => <MatchCard key={s.id} session={s} onEdit={() => edit(s.id)} />)}
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow">Results</h2>
              <span className="text-xs text-muted">{seasonGames.length === 1 ? '1 match' : `${seasonGames.length} matches`}</span>
            </div>
            {years.length > 1 && (
              <Pills
                options={years.map((y) => ({ value: y, label: `${y} season` }))}
                value={activeYear}
                onChange={(y) => { setYear(y); setShown(PAGE_SIZE) }}
              />
            )}
            <div className="stagger space-y-3">
              {seasonGames.slice(0, shown).map((s) => <MatchCard key={s.id} session={s} onEdit={() => edit(s.id)} />)}
            </div>
            {seasonGames.length > shown && (
              <button type="button" className="btn btn-quiet btn-block" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, seasonGames.length - shown)} more
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
