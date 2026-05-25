import { useEffect } from 'react'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(onClose, 2600)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const danger = toast.type === 'error'
  return (
    <div className="fixed right-4 top-4 z-[80] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-sm">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          danger ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
        }`}
        aria-hidden="true"
      >
        {danger ? '!' : 'i'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{toast.title || (danger ? 'Gagal' : 'Berhasil')}</p>
        {toast.message && <p className="mt-0.5 text-slate-600 dark:text-slate-400">{toast.message}</p>}
      </div>
      <button type="button" className="shrink-0 rounded-md px-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={onClose} aria-label="Tutup notifikasi">
        x
      </button>
    </div>
  )
}
