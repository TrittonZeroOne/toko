import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeCtx = createContext(null)
const STORAGE_KEY = 'toko-theme'

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

function systemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = readStored()
    if (stored) return stored
    return systemIsDark() ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#059669')
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const value = useMemo(() => ({ theme, setTheme, toggle, isDark: theme === 'dark' }), [theme])

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme harus di dalam ThemeProvider')
  return ctx
}
