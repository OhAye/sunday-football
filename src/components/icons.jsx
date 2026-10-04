// Line icons (24px grid, currentColor). Size with className, e.g. <EditIcon className="w-4 h-4" />.

function Svg({ className = 'w-5 h-5', strokeWidth = 1.8, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p) => (
  <Svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></Svg>
)
// A pitch seen from above
export const PitchIcon = (p) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M12 4.5v15" /><circle cx="12" cy="12" r="2.6" /><path d="M3 9.5h2.5v5H3M21 9.5h-2.5v5H21" /></Svg>
)
// Two shirts swapping sides — the team balancer
export const BalanceIcon = (p) => (
  <Svg {...p}><path d="M7 4 3.5 7.5 7 11" /><path d="M3.5 7.5H15a5 5 0 0 1 5 5" /><path d="m17 20 3.5-3.5L17 13" /><path d="M20.5 16.5H9a5 5 0 0 1-5-5" /></Svg>
)
export const StatsIcon = (p) => (
  <Svg {...p}><path d="M4 20V11" /><path d="M10 20V4" /><path d="M16 20v-6" /><path d="M21 20H3" /></Svg>
)
export const SquadIcon = (p) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><path d="M16 4.6a3.2 3.2 0 0 1 0 6.3" /><path d="M21 20v-1a6 6 0 0 0-3.5-5.4" /></Svg>
)
export const PlusIcon = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const MinusIcon = (p) => <Svg {...p}><path d="M5 12h14" /></Svg>
export const CloseIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
export const CheckIcon = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
export const EditIcon = (p) => <Svg {...p}><path d="M16.5 4.5 19.5 7.5 8.5 18.5H5.5v-3z" /><path d="m14 7 3 3" /></Svg>
export const TrashIcon = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7l.8 12.5h9.4L17.5 7" /><path d="M10 11v5M14 11v5" /></Svg>
)
export const ChevronDownIcon = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
export const ChevronRightIcon = (p) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
export const ArrowLeftIcon = (p) => <Svg {...p}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></Svg>
export const BackspaceIcon = (p) => <Svg {...p}><path d="M21 5H9l-6 7 6 7h12z" /><path d="m12 9.5 5 5M17 9.5l-5 5" /></Svg>
export const SwapIcon = (p) => <Svg {...p}><path d="M7 4v16" /><path d="m3.5 7.5 3.5-3.5 3.5 3.5" /><path d="M17 20V4" /><path d="m13.5 16.5 3.5 3.5 3.5-3.5" /></Svg>
export const LockIcon = (p) => <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></Svg>
export const SearchIcon = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></Svg>
export const CameraIcon = (p) => (
  <Svg {...p}><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10.5H4z" /><circle cx="12" cy="13.5" r="3.2" /></Svg>
)
export const CalendarIcon = (p) => <Svg {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Svg>
export const ShuffleIcon = (p) => (
  <Svg {...p}><path d="M3 7h3.5c5 0 6 10 11 10H21" /><path d="m18 14 3 3-3 3" /><path d="M3 17h3.5c1.6 0 2.8-1 3.8-2.4" /><path d="M21 7h-3.5c-1.6 0-2.8 1-3.8 2.4" /><path d="m18 4 3 3-3 3" /></Svg>
)
export const NoteIcon = (p) => <Svg {...p}><path d="M6 3.5h9l3.5 3.5v13.5H6z" /><path d="M9.5 11h5.5M9.5 15h5.5" /></Svg>
export const StarIcon = ({ className = 'w-4 h-4', ...p }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" {...p}>
    <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z" />
  </svg>
)
export const WhatsAppIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)
