import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { mediaUrl, productPrimaryUrl } from '../media.js'

function personName(u, fallback = 'Customer') {
  if (!u) return fallback
  return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || fallback
}

function orderSummary(order) {
  const items = order?.items || []
  if (!order?.id) return ''
  if (items.length === 0) return `Order #${order.id}`
  const first = items[0]
  const name = first.product?.name || '#' + first.product_id
  const variant = first.variant_name ? ` - ${first.variant_name}` : ''
  const extra = items.length > 1 ? ` dan ${items.length - 1} produk lainnya` : ''
  return `Order #${order.id}: ${name}${variant}${extra}`
}

function productSummary(product, productId) {
  if (product?.name) return product.name
  if (productId) return `Produk #${productId}`
  return 'Chat umum'
}

function threadKey(msg) {
  return `${msg.user_id || 0}`
}

function queryKey(userId) {
  return `${userId || 0}`
}

function orderStatusLabel(status) {
  if (status === 'belum_dibayar') return 'Belum dibayar'
  if (status === 'pending') return 'Menunggu diproses'
  if (status === 'dikemas') return 'Dikemas'
  if (status === 'dikirim') return 'Dikirim'
  if (status === 'dibatalkan') return 'Dibatalkan'
  return status || ''
}

function contextFromMessage(msg) {
  if (msg.order?.id) {
    const first = msg.order.items?.[0]
    const product = msg.product?.id ? msg.product : first?.product
    return {
      type: 'order',
      order: msg.order,
      product,
      productId: msg.product_id || first?.product_id || product?.id || 0,
      title: orderSummary(msg.order),
      status: orderStatusLabel(msg.order.status),
    }
  }
  if (msg.product?.id || msg.product_id) {
    return {
      type: 'product',
      product: msg.product,
      productId: msg.product_id || msg.product?.id || 0,
      title: productSummary(msg.product, msg.product_id),
      status: '',
    }
  }
  return null
}

function groupThreads(messages, user, isAdmin, searchParams) {
  const map = new Map()
  const wantedOrder = Number(searchParams.get('order_id') || 0)
  const wantedProduct = Number(searchParams.get('product_id') || 0)
  messages.forEach((msg) => {
    const key = threadKey(msg)
    if (!map.has(key)) {
      map.set(key, {
        key,
        user_id: msg.user_id,
        order_id: 0,
        product_id: 0,
        user: msg.user,
        order: msg.order,
        product: msg.product,
        messages: [],
      })
    }
    const t = map.get(key)
    t.messages.push(msg)
    if (msg.order?.id) t.order = msg.order
    if (msg.product?.id) t.product = msg.product
    if (msg.user?.id) t.user = msg.user
  })

  if (!isAdmin && (wantedOrder || wantedProduct)) {
    const key = queryKey(user?.id)
    if (!map.has(key)) {
      map.set(key, {
        key,
        user_id: user?.id,
        order_id: wantedOrder,
        product_id: wantedProduct,
        user,
        order: wantedOrder ? { id: wantedOrder, items: [] } : null,
        product: wantedProduct ? { id: wantedProduct } : null,
        messages: [],
      })
    }
    const t = map.get(key)
    t.order_id = wantedOrder
    t.product_id = wantedProduct
    if (wantedOrder && !t.order?.id) t.order = { id: wantedOrder, items: [] }
    if (wantedProduct && !t.product?.id) t.product = { id: wantedProduct }
  }
  if (!isAdmin && !wantedOrder && !wantedProduct && map.size === 0) {
    const key = queryKey(user?.id)
    map.set(key, {
      key,
      user_id: user?.id,
      order_id: 0,
      product_id: 0,
      user,
      order: null,
      product: null,
      messages: [],
    })
  }

  const list = Array.from(map.values())
  list.sort((a, b) => {
    const at = a.messages.at(-1)?.created_at || ''
    const bt = b.messages.at(-1)?.created_at || ''
    return String(bt).localeCompare(String(at))
  })
  return list
}

export default function Chat() {
  const { user, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState([])
  const [activeKey, setActiveKey] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const threads = useMemo(() => groupThreads(messages, user, isAdmin, searchParams), [messages, user, isAdmin, searchParams])
  const active = threads.find((t) => t.key === activeKey) || threads[0]
  const wantedOrder = Number(searchParams.get('order_id') || 0)
  const wantedProduct = Number(searchParams.get('product_id') || 0)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const data = await api(isAdmin ? '/api/admin/chats' : '/api/chat')
      setMessages(Array.isArray(data) ? data : [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isAdmin])

  useEffect(() => {
    if (threads.length === 0) return
    const wanted = isAdmin
      ? threads.find((t) => t.messages.some((m) => (wantedOrder && Number(m.order_id) === wantedOrder) || (wantedProduct && Number(m.product_id) === wantedProduct)))?.key || ''
      : queryKey(user?.id)
    if (wanted && threads.some((t) => t.key === wanted)) {
      setActiveKey(wanted)
      return
    }
    if (!activeKey || !threads.some((t) => t.key === activeKey)) setActiveKey(threads[0].key)
  }, [threads, searchParams, user, isAdmin, activeKey])

  async function send(e) {
    e.preventDefault()
    const message = text.trim()
    if (!message || !active) return
    setSending(true)
    setErr('')
    try {
      const payload = {
        message,
        user_id: active.user_id,
        order_id: wantedOrder || active.order_id || 0,
        product_id: wantedProduct || active.product_id || 0,
      }
      const row = await api(isAdmin ? '/api/admin/chats' : '/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setMessages((prev) => [...prev, row])
      setText('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSending(false)
    }
  }

  const title = isAdmin ? 'Chat Customer' : 'Chat Admin'

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Percakapan tersimpan dalam satu ruang chat customer.</p>
        </div>
        {!isAdmin && (
          <Link to="/" className="btn-secondary w-fit">
            Lihat produk
          </Link>
        )}
      </div>

      {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">{err}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="card-elevated p-0 sm:p-0">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">Percakapan</div>
          <div className="max-h-[34rem] overflow-y-auto p-2">
            {loading && <p className="px-3 py-4 text-sm text-slate-500">Memuat chat...</p>}
            {!loading && threads.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Belum ada chat.</p>}
            {threads.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${active?.key === t.key ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}
                onClick={() => setActiveKey(t.key)}
              >
                <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{isAdmin ? personName(t.user) : 'Chat admin'}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                  {t.messages.at(-1)?.message || (t.order_id ? orderSummary(t.order) : productSummary(t.product, t.product_id))}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card-elevated flex min-h-[32rem] flex-col p-0 sm:p-0">
          {active ? (
            <>
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{isAdmin ? personName(active.user) : 'Admin Toko'}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {wantedOrder || active.order_id ? orderSummary(active.order) : wantedProduct || active.product_id ? productSummary(active.product, active.product_id || wantedProduct) : 'Semua pertanyaan produk dan pesanan tampil di sini.'}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.messages.length === 0 && <p className="text-sm text-slate-500">Mulai percakapan.</p>}
                {active.messages.map((m) => {
                  const mine = isAdmin ? m.sender_role === 'admin' : m.sender_role === 'customer'
                  const ctx = contextFromMessage(m)
                  const img = productPrimaryUrl(ctx?.product)
                  return (
                    <div key={m.id} className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${mine ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                      <p className="text-xs font-semibold opacity-80">{mine ? 'Saya' : m.sender_role === 'admin' ? 'Admin' : personName(m.sender)}</p>
                      {ctx && (
                        <Link
                          to={ctx.productId ? `/product/${ctx.productId}` : '#'}
                          className={`mt-2 flex items-center gap-2 rounded-lg border p-2 text-left ${mine ? 'border-white/25 bg-white/10 text-white hover:bg-white/15' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'}`}
                        >
                          <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-md ${mine ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            {img ? <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{ctx.title}</p>
                            {ctx.status && <p className={`mt-0.5 text-[11px] ${mine ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'}`}>Status: {ctx.status}</p>}
                          </div>
                        </Link>
                      )}
                      <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                    </div>
                  )
                })}
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
                <input className="input-field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..." />
                <button type="submit" disabled={sending || !text.trim()} className="btn-primary disabled:opacity-50">
                  Kirim
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">Pilih percakapan.</div>
          )}
        </section>
      </div>
    </div>
  )
}
