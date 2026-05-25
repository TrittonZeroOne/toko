import { useTheme } from './theme.jsx'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Mode terang' : 'Mode gelap'}
      aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className={`group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 text-amber-500 shadow-sm transition hover:border-emerald-300/60 hover:shadow-md dark:border-slate-600/80 dark:bg-slate-800/90 dark:text-amber-300 dark:hover:border-emerald-500/40 ${className}`}
    >
      <span
        className={`absolute inset-0 flex items-center justify-center text-slate-200 transition-all duration-300 ${
          dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-8 rotate-90 opacity-0'
        }`}
        aria-hidden
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.27 1 1 0 0 0-.36-1.63Z" />
        </svg>
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center text-amber-500 transition-all duration-300 ${
          dark ? 'translate-y-8 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100'
        }`}
        aria-hidden
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
    </button>
  )
}
