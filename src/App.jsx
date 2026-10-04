import { HashRouter as BrowserRouter, Routes, Route, useLocation, useParams } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Lineups from './pages/Lineups'
import Stats from './pages/Stats'
import Players from './pages/Players'
import Admin from './pages/Admin'
import Vote from './pages/Vote'
import Balancer from './pages/Balancer'
import PlayerProfile from './pages/PlayerProfile'

function PlayerProfileKeyed() {
  const { id } = useParams()
  return <PlayerProfile key={id} />
}

function Shell() {
  const location = useLocation()
  const isAdmin = location.pathname === '/admin'
  const isVote = location.pathname.startsWith('/vote/')
  return (
    <div className="min-h-screen bg-[#0b0f14] flex flex-col max-w-lg mx-auto relative">
      <main className={`flex-1 overflow-y-auto ${isAdmin || isVote ? '' : 'pb-24'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lineups" element={<Lineups />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/players" element={<Players />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/balance" element={<Balancer />} />
          <Route path="/player/:id" element={<PlayerProfileKeyed />} />
          <Route path="/vote/:sessionId" element={<Vote />} />
        </Routes>
      </main>
      {!isAdmin && !isVote && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  )
}
