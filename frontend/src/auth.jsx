import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { api } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Sinkronkan profil dari server (nama depan/belakang), supaya header tidak tertahan data localStorage lama.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const u = await api('/api/me')
        if (!cancelled) setUser(u)
      } catch {
        if (!cancelled) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  const value = useMemo(
    () => ({
      user,
      setUser,
      logout() {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      },
      isAdmin: user?.role === 'admin',
    }),
    [user],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth di luar AuthProvider')
  return v
}
