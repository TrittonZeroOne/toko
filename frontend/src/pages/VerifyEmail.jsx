import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('Memverifikasi email...')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const token = params.get('token') || ''
    if (!token) {
      setStatus('Token verifikasi tidak ditemukan.')
      return
    }
    api('/api/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        setOk(true)
        setStatus(data.message || 'Email berhasil diverifikasi.')
      })
      .catch((e) => setStatus(e.message))
  }, [params])

  return (
    <div className="mx-auto max-w-md animate-fade-in">
      <div className="card-elevated text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Verifikasi Email</h1>
        <p className={`mt-4 text-sm ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>{status}</p>
        <Link to="/login" className="btn-primary mt-6 inline-flex">
          Masuk
        </Link>
      </div>
    </div>
  )
}
