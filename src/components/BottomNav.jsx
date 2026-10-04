import { NavLink } from 'react-router-dom'
import { BalanceIcon, HomeIcon, PitchIcon, SquadIcon, StatsIcon } from './icons'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/lineups', label: 'Games', Icon: PitchIcon },
  { to: '/balance', label: 'Teams', Icon: BalanceIcon, primary: true },
  { to: '/stats', label: 'Stats', Icon: StatsIcon },
  { to: '/players', label: 'Squad', Icon: SquadIcon },
]

// Floating glass dock. The centre tab is raised — picking teams is the weekly headline job.
export default function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div className="glass pointer-events-auto mx-auto flex max-w-[456px] items-end rounded-[26px] px-1">
        {tabs.map(({ to, label, primary, ...tab }) => {
          const TabIcon = tab.Icon
          return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 transition-colors duration-200 ${
                isActive ? 'text-green-bright' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {primary ? (
                  <span
                    className={`-mt-8 flex h-[52px] w-[52px] items-center justify-center rounded-full border-4 border-pitch text-white transition-transform duration-200 ${
                      isActive ? 'scale-105' : ''
                    }`}
                    style={{
                      background: 'linear-gradient(160deg, #22c55e, #15803d)',
                      boxShadow: isActive
                        ? '0 0 0 2px #22c55e, 0 10px 24px -6px rgba(22,163,74,0.9)'
                        : '0 10px 22px -8px rgba(22,163,74,0.8)',
                    }}
                  >
                    <TabIcon className="w-6 h-6" strokeWidth={2} />
                  </span>
                ) : (
                  <>
                    {isActive && (
                      <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-green-bright shadow-[0_0_12px_#22c55e]" />
                    )}
                    <TabIcon className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  </>
                )}
                <span className="font-display text-[10px] font-medium uppercase tracking-[0.16em]">{label}</span>
              </>
            )}
          </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
