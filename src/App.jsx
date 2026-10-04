import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/app-context'
import FeedbackProvider from './components/Feedback'
import BottomNav from './components/BottomNav'
import { Loading } from './components/ui'
import Dashboard from './pages/Dashboard'

// Everything but Home is split out — Stats alone carries the charting library.
const Lineups = lazy(() => import('./pages/Lineups'))
const MatchEditor = lazy(() => import('./pages/MatchEditor'))
const Stats = lazy(() => import('./pages/Stats'))
const Players = lazy(() => import('./pages/Players'))
const Balancer = lazy(() => import('./pages/Balancer'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Admin = lazy(() => import('./pages/Admin'))
const Vote = lazy(() => import('./pages/Vote'))

// Remount the profile when moving between players so its local state resets
function PlayerProfileKeyed() {
  const { id } = useParams()
  return <PlayerProfile key={id} />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function LoadErrorBanner() {
  const { loadError, reload } = useApp()
  if (!loadError) return null
  return (
    <div role="alert" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-red/40 bg-red-dim px-4 py-3">
      <p className="flex-1 text-sm text-red-bright">Couldn’t reach the server. What you see may be out of date.</p>
      <button type="button" className="btn btn-sm btn-quiet" onClick={reload}>Retry</button>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  // Full-screen pages without the nav: admin, the public vote page and the match editor
  const bare = pathname === '/admin' || pathname.startsWith('/vote/') || pathname.startsWith('/lineups/')
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col">
      <ScrollToTop />
      <main className={`flex-1 ${bare ? '' : 'pb-32'}`}>
        {!bare && <LoadErrorBanner />}
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lineups" element={<Lineups />} />
            <Route path="/lineups/new" element={<MatchEditor />} />
            <Route path="/lineups/:id/edit" element={<MatchEditor />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/players" element={<Players />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/balance" element={<Balancer />} />
            <Route path="/player/:id" element={<PlayerProfileKeyed />} />
            <Route path="/vote/:sessionId" element={<Vote />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {!bare && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </FeedbackProvider>
    </HashRouter>
  )
}
