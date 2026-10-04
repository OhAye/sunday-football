import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { Loading } from '../components/ui'
import MatchForm from '../components/match/MatchForm'

// /lineups/new and /lineups/:id/edit — a real route so the browser back button leaves the form.
export default function MatchEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, sessionsLoaded } = useApp()

  if (!sessionsLoaded) return <Loading />
  const session = id ? sessions.find((s) => s.id === id) : null
  if (id && !session) return <Navigate to="/lineups" replace />

  return <MatchForm key={id ?? 'new'} session={session} onDone={() => navigate('/lineups', { replace: true })} />
}
