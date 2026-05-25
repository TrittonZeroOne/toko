import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function Register() {
  const nav = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setOk('')
    try {
      const data = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email,
          password,
        }),
      })
      setOk(data.message || 'Akun dibuat. Cek email untuk verifikasi sebelum login.')
      setTimeout(() => nav('/login'), 1200)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-in px-1 sm:px-0">
      <div className="card-elevated relative overflow-hidden">
        <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-teal-400/20 blur-2xl dark:bg-teal-500/15" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Mulai sekarang</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Daftar</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Buat akun customer untuk berbelanja.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-fn" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama depan
                </label>
                <input
                  id="reg-fn"
                  className="input-field"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-ln" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama belakang
                </label>
                <input
                  id="reg-ln"
                  className="input-field"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="reg-email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="reg-pass" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password <span className="font-normal text-slate-500 dark:text-slate-400">(min. 6 karakter)</span>
              </label>
              <input
                id="reg-pass"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {err}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                {ok}
              </div>
            )}
            <button type="submit" className="btn-primary w-full py-3 text-base">
              Buat akun
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Sudah punya akun?{' '}
            <Link className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400" to="/login">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
