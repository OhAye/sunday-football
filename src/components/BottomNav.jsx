import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 12L12 3l9 9" stroke="currentColor" />
        <path d="M9 21V12h6v9" stroke="currentColor" />
        <path d="M3 12v9h18V12" stroke="currentColor" />
      </svg>
    ),
  },
  {
    to: '/lineups',
    label: 'Games',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="9" cy="7" r="3" stroke="currentColor" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" stroke="currentColor" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" />
        <rect x="10" y="7" width="4" height="14" rx="1" stroke="currentColor" />
        <rect x="17" y="3" width="4" height="18" rx="1" stroke="currentColor" />
      </svg>
    ),
  },
  {
    to: '/players',
    label: 'Players',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="8" r="4" stroke="currentColor" />
        <path d="M4 20v-1a8 8 0 0 1 16 0v1" stroke="currentColor" />
      </svg>
    ),
  },
  {
    to: '/balance',
    label: 'Teams',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 3v18" stroke="currentColor" />
        <path d="M3 6h9M3 12h9M3 18h9" stroke="currentColor" />
        <path d="M12 6h9M12 12h9M12 18h9" stroke="currentColor" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200 relative ${
                isActive ? 'text-[#16a34a]' : 'text-[#475569] hover:text-[#94a3b8]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-[0_0_6px_#16a34a88]' : ''}`}>
                  {icon}
                </span>
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{ fontFamily: "'Oswald', sans-serif" }}
                >
                  {label}
                </span>
                {isActive && (
                  <span
                    className="absolute top-0 w-10 h-[2px] rounded-full tab-glow"
                    style={{ background: 'linear-gradient(90deg, transparent, #16a34a, transparent)' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
      {/* safe area spacer for iOS */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  )
}
