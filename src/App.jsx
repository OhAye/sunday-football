import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Lineups from './pages/Lineups'
import Stats from './pages/Stats'
import Players from './pages/Players'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#0b0f14] flex flex-col max-w-lg mx-auto relative">
          <main className="flex-1 overflow-y-auto pb-24">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/lineups" element={<Lineups />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/players" element={<Players />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
