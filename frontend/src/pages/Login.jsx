import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setMsg('')
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('token', data.token)
      setUser(data.user)
      nav(data.user.role === 'admin' ? '/admin' : '/')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function resendVerification() {
    setErr('')
    setMsg('')
    try {
      const data = await api('/api/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMsg(data.message || 'Email verifikasi dikirim ulang.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function requestOTP() {
    setResetErr('')
    setResetMsg('')
    try {
      const data = await api('/api/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      })
      setResetOpen(true)
      setResetMsg(data.message || 'OTP reset password sudah dikirim ke email Anda.')
    } catch (e) {
      setResetOpen(false)
      setResetErr(e.message)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setResetErr('')
    setResetMsg('')
    try {
      const data = await api('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, otp, new_password: newPassword }),
      })
      setResetMsg(data.message || 'Password berhasil diubah.')
      setOtp('')
      setNewPassword('')
      setResetOpen(false)
    } catch (e) {
      setResetErr(e.message)
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-in px-1 sm:px-0">
      {!forgotOpen ? (
        <div className="card-elevated relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-500/15" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Selamat datang</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Masuk</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Lanjut belanja dengan akun Anda.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  id="login-email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-pass" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <input
                  id="login-pass"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {err}
                </div>
              )}
              {msg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {msg}
                </div>
              )}
              <button type="submit" className="btn-primary w-full py-3 text-base">
                Masuk
              </button>
              <div className="flex flex-wrap justify-center gap-3 text-sm">
                <button type="button" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" onClick={resendVerification}>
                  Kirim ulang verifikasi
                </button>
                <button
                  type="button"
                  className="font-semibold text-slate-700 hover:underline dark:text-slate-300"
                  onClick={() => {
                    setForgotEmail(email)
                    setResetErr('')
                    setResetMsg('')
                    setResetOpen(false)
                    setForgotOpen(true)
                  }}
                >
                  Lupa password
                </button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Belum punya akun?{' '}
              <Link className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400" to="/register">
                Daftar
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="card-elevated relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-500/15" />
          <div className="relative space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Reset akun</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Lupa password</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Masukkan email akun untuk menerima OTP reset password.</p>
            </div>
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email akun
              </label>
              <input
                id="forgot-email"
                className="input-field"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
            {resetErr && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {resetErr}
              </div>
            )}
            {resetMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                {resetMsg}
              </div>
            )}
            <button type="button" className="btn-secondary w-full" onClick={requestOTP}>
              Kirim OTP
            </button>
            {resetOpen && (
              <form onSubmit={resetPassword} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reset password dengan OTP</p>
                <input className="input-field" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Kode OTP" required />
                <input className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" minLength={6} placeholder="Password baru" required />
                <button type="submit" className="btn-primary w-full">Ubah password</button>
              </form>
            )}
            <button
              type="button"
              className="w-full text-sm font-semibold text-slate-700 hover:underline dark:text-slate-300"
              onClick={() => {
                setForgotOpen(false)
                setResetErr('')
                setResetMsg('')
                setResetOpen(false)
              }}
            >
              Kembali ke login
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
