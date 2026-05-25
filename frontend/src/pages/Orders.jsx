import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Toast from '../Toast.jsx'

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function reviewed(order, productId) {
  return (order.reviews || []).some((r) => Number(r.product_id) === Number(productId))
}

function statusLabel(status) {
  if (status === 'belum_dibayar') return 'Belum dibayar'
  return status
}

function orderSummary(order) {
  const items = order.items || []
  if (items.length === 0) return 'Pesanan'
  const first = items[0]
  const name = first.product?.name || '#' + first.product_id
  const variant = first.variant_name ? ` - ${first.variant_name}` : ''
  const extra = items.length > 1 ? ` dan ${items.length - 1} produk lainnya` : ''
  return `${name}${variant}${extra}`
}

function senderName(msg) {
  if (msg.sender_role === 'admin') return 'Admin'
  const u = msg.sender
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || u?.email || 'Saya'
}

function OrderChat({ order }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  async function loadMessages() {
    setLoading(true)
    setErr('')
    try {
      const data = await api('/api/orders/' + order.id + '/messages')
      setMessages(data.messages || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) await loadMessages()
  }

  async function send(e) {
    e.preventDefault()
    const message = text.trim()
    if (!message) return
    setSending(true)
    setErr('')
    try {
      const row = await api('/api/orders/' + order.id + '/messages', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      setMessages((prev) => [...prev, row])
      setText('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={toggle}>
        {open ? 'Tutup chat' : 'Chat admin'}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Membahas: {orderSummary(order)}</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {loading && <p className="text-xs text-slate-500">Memuat chat...</p>}
            {!loading && messages.length === 0 && <p className="text-xs text-slate-500">Belum ada pesan.</p>}
            {messages.map((m) => {
              const mine = m.sender_role === 'customer'
              return (
                <div key={m.id} className={`rounded-lg px-3 py-2 text-xs ${mine ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'} max-w-[85%]`}>
                  <p className="font-semibold">{mine ? 'Saya' : senderName(m)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                </div>
              )
            })}
          </div>
          {err && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{err}</p>}
          <form onSubmit={send} className="mt-3 flex gap-2">
            <input className="input-field py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pertanyaan..." />
            <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
              Kirim
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ReviewForm({ order, item, onSaved }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api('/api/orders/' + order.id + '/reviews', {
        method: 'POST',
        body: JSON.stringify({
          product_id: item.product_id,
          rating,
          comment,
        }),
      })
      setComment('')
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Rating</label>
        <select className="input-field max-w-[120px] py-1.5 text-sm" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="input-field mt-3 min-h-[76px] resize-y text-sm"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tulis komentar produk..."
      />
      {err && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{err}</p>}
      <button type="submit" disabled={saving} className="btn-primary mt-3 px-4 py-2 text-sm">
        {saving ? 'Menyimpan...' : 'Konfirmasi diterima & kirim ulasan'}
      </button>
    </form>
  )
}

export default function Orders() {
  const [list, setList] = useState([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)

  function loadOrders() {
    api('/api/orders')
      .then(setList)
      .catch((e) => setErr(e.message))
  }

  useEffect(() => {
    loadOrders()
  }, [])

  async function payOrder(id) {
    setErr('')
    setBusyId(id)
    try {
      const data = await api('/api/create-transaction', {
        method: 'POST',
        body: JSON.stringify({ order_id: id }),
      })
      setToast({ type: 'success', title: 'Berhasil', message: 'Pembayaran dibuka ulang' })
      window.location.href = data.payment_url
    } catch (e) {
      setErr(e.message)
      setToast({ type: 'error', title: 'Gagal', message: e.message })
      setBusyId(null)
    }
  }

  async function cancelOrder(id) {
    if (!confirm('Batalkan pesanan yang belum dibayar? Stok produk akan dikembalikan.')) return
    setErr('')
    setBusyId(id)
    try {
      await api('/api/orders/' + id + '/cancel', { method: 'POST' })
      loadOrders()
      setToast({ type: 'success', title: 'Berhasil', message: 'Pesanan dibatalkan' })
    } catch (e) {
      setErr(e.message)
      setToast({ type: 'error', title: 'Gagal', message: e.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Pesanan saya</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Riwayat order, bukti pemesanan, dan ulasan produk.</p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {list.map((o) => (
          <li key={o.id} className="card-elevated">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-bold text-slate-900 dark:text-slate-100">Order #{o.id}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {new Date(o.created_at).toLocaleString('id-ID')} -{' '}
                  <span className="font-medium uppercase text-emerald-700 dark:text-emerald-400">{statusLabel(o.status)}</span>
                </p>
                <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">{formatIDR(o.total)}</p>
                {o.tracking_number && (
                  <p className="mt-2 inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
                    Resi: {o.tracking_number}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:min-w-[140px]">
                {o.status === 'belum_dibayar' && (o.payment_method || '').startsWith('midtrans_') && (
                  <button type="button" disabled={busyId === o.id} onClick={() => payOrder(o.id)} className="btn-primary text-center disabled:opacity-50">
                    {busyId === o.id ? 'Memproses...' : 'Bayar'}
                  </button>
                )}
                {o.status === 'belum_dibayar' && (
                  <button type="button" disabled={busyId === o.id} onClick={() => cancelOrder(o.id)} className="btn-danger text-center disabled:opacity-50">
                    Batalkan
                  </button>
                )}
                <Link to={'/orders/' + o.id + '/print'} className="btn-secondary text-center">
                  Cetak bukti
                </Link>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Link to={`/chat?order_id=${o.id}`} className="btn-secondary inline-flex px-3 py-1.5 text-xs">
                Chat admin
              </Link>
            </div>

            {(o.items || []).length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                {(o.items || []).map((it) => {
                  const isReviewed = reviewed(o, it.product_id)
                  return (
                    <div key={it.id} className="text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {it.product?.name || '#' + it.product_id}
                            {it.variant_name ? ` - ${it.variant_name}` : ''}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Qty {it.qty} - {formatIDR(it.price)}
                          </p>
                        </div>
                        {isReviewed && (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Sudah diulas
                          </span>
                        )}
                      </div>
                      {o.status === 'dikirim' && !isReviewed && <ReviewForm order={o} item={it} onSaved={loadOrders} />}
                    </div>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!err && list.length === 0 && (
        <div className="card-elevated mt-8 py-12 text-center text-slate-600 dark:text-slate-400">Belum ada pesanan.</div>
      )}
    </div>
  )
}
