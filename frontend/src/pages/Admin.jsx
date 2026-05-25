import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, apiForm } from '../api.js'
import { mediaUrl, productImagesSorted, productPrimaryUrl } from '../media.js'
import { useAuth } from '../auth.jsx'
import Toast from '../Toast.jsx'

const tabs = [
  { id: 'products', label: 'Produk' },
  { id: 'categories', label: 'Kategori' },
  { id: 'orders', label: 'Order' },
  { id: 'sales', label: 'Laporan' },
]

const orderStatuses = ['dikemas', 'dikirim', 'dibatalkan']

function adminCanSetStatus(order, nextStatus) {
  if (order.status === 'belum_dibayar' || order.status === 'pending') return false
  if (order.status === 'dibatalkan' && nextStatus !== 'dibatalkan') return false
  if (order.status === 'dikirim' && nextStatus === 'dibatalkan') return false
  return true
}

function adminStatusTitle(order, nextStatus) {
  if (order.status === 'belum_dibayar' || order.status === 'pending') return 'Pesanan belum bayar tidak bisa diubah statusnya'
  if (order.status === 'dibatalkan' && nextStatus !== 'dibatalkan') return 'Pesanan dibatalkan tidak bisa diubah lagi'
  if (order.status === 'dikirim' && nextStatus === 'dibatalkan') return 'Pesanan dikirim tidak bisa dibatalkan'
  return ''
}

function statusBadgeClass(status) {
  if (status === 'dikirim') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  if (status === 'dikemas') return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
  if (status === 'dibatalkan') return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
  if (status === 'belum_dibayar') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
}

function statusLabel(status) {
  if (status === 'belum_dibayar') return 'Belum dibayar'
  return status
}

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
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
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || u?.email || 'Customer'
}

function AdminOrderChat({ order, customer }) {
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
      const data = await api('/api/admin/orders/' + order.id + '/messages')
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
      const row = await api('/api/admin/orders/' + order.id + '/messages', {
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
    <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">Chat pesanan</p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            {customer} menanyakan {orderSummary(order)}
          </p>
        </div>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={toggle}>
          {open ? 'Tutup' : 'Buka chat'}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {loading && <p className="text-xs text-slate-500">Memuat chat...</p>}
            {!loading && messages.length === 0 && <p className="text-xs text-slate-500">Belum ada pertanyaan untuk order ini.</p>}
            {messages.map((m) => {
              const mine = m.sender_role === 'admin'
              return (
                <div key={m.id} className={`rounded-lg px-3 py-2 ${mine ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'} max-w-[85%]`}>
                  <p className="font-semibold">{mine ? 'Admin' : senderName(m)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                </div>
              )
            })}
          </div>
          {err && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{err}</p>}
          <form onSubmit={send} className="mt-3 flex gap-2">
            <input className="input-field py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Balas customer..." />
            <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
              Kirim
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function SalesChart({ rows = [] }) {
  const data = Array.isArray(rows) ? rows : []
  const maxRevenue = Math.max(1, ...data.map((r) => Number(r.revenue || 0)))
  const maxOrders = Math.max(1, ...data.map((r) => Number(r.orders || 0)))
  return (
    <div className="card-elevated">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Grafik penjualan</h2>
        <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Pendapatan</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Order</span>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada data untuk digrafikkan.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[520px] items-end gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            {data.map((r) => {
              const revenueHeight = Math.max(8, (Number(r.revenue || 0) / maxRevenue) * 180)
              const orderHeight = Math.max(6, (Number(r.orders || 0) / maxOrders) * 90)
              return (
                <div key={r.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-48 items-end gap-1">
                    <div className="w-5 rounded-t bg-emerald-500/85" style={{ height: revenueHeight }} title={formatIDR(r.revenue || 0)} />
                    <div className="w-3 rounded-t bg-sky-500/85" style={{ height: orderHeight }} title={`${r.orders || 0} order`} />
                  </div>
                  <span className="max-w-16 truncate text-[10px] text-slate-500 dark:text-slate-400" title={r.day}>
                    {String(r.day).slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Nama tampil untuk pelanggan di order / header */
function customerName(u) {
  if (!u) return '—'
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return n || u.email || '—'
}

const emptyProductForm = {
  name: '',
  description: '',
  price: 0,
  stock: 0,
  weight_gram: 500,
  category_id: 0,
  variants: [],
}

const emptyVariant = () => ({ name: '', sku: '', price: 0, stock: 0, weight_gram: 500 })

export default function Admin() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab')
  const tab = tabs.some((t) => t.id === currentTab) ? currentTab : 'products'
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [trackingInputs, setTrackingInputs] = useState({})
  const [sales, setSales] = useState(null)
  const [salesFrom, setSalesFrom] = useState(() => {
    const t = new Date()
    t.setDate(t.getDate() - 29)
    return t.toISOString().slice(0, 10)
  })
  const [salesTo, setSalesTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [err, setErr] = useState('')
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(emptyProductForm)
  const [imageFiles, setImageFiles] = useState([])
  const [blobPreviews, setBlobPreviews] = useState([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [editingProductId, setEditingProductId] = useState(null)
  /** Gambar yang sudah di server { id?, image_url } */
  const [serverImages, setServerImages] = useState([])
  const [catForm, setCatForm] = useState({ name: '', slug: '' })
  const [editingCatId, setEditingCatId] = useState(null)

  useEffect(() => {
    if (!imageFiles.length) {
      setBlobPreviews([])
      return
    }
    const urls = imageFiles.map((f) => URL.createObjectURL(f))
    setBlobPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [imageFiles])

  const loadProducts = useCallback(() => {
    api('/api/admin/products')
      .then((data) => setProducts((data || []).filter((p) => !p.deleted_at)))
      .catch((e) => setErr(e.message))
  }, [])
  const loadCategories = useCallback(() => {
    api('/api/categories').then(setCategories).catch((e) => setErr(e.message))
  }, [])
  const loadOrders = useCallback(() => {
    api('/api/admin/orders')
      .then((data) => {
        setOrders(data)
        setTrackingInputs((prev) => {
          const next = { ...prev }
          ;(data || []).forEach((o) => {
            if (next[o.id] == null) next[o.id] = o.tracking_number || ''
          })
          return next
        })
      })
      .catch((e) => setErr(e.message))
  }, [])
  const loadSales = useCallback(() => {
    const q = '?from=' + encodeURIComponent(salesFrom) + '&to=' + encodeURIComponent(salesTo)
    api('/api/admin/sales/summary' + q)
      .then(setSales)
      .catch((e) => setErr(e.message))
  }, [salesFrom, salesTo])

  useEffect(() => {
    setErr('')
    if (tab === 'products') {
      loadProducts()
      loadCategories()
    }
    if (tab === 'categories') loadCategories()
    if (tab === 'orders') loadOrders()
    if (tab === 'sales') loadSales()
  }, [tab, loadProducts, loadCategories, loadOrders, loadSales])

  useEffect(() => {
    if (!currentTab || !tabs.some((t) => t.id === currentTab)) {
      setSearchParams({ tab: 'products' }, { replace: true })
    }
  }, [currentTab, setSearchParams])

  function notify(message, type = 'success', title = type === 'error' ? 'Gagal' : 'Berhasil') {
    setToast({ title, message, type })
  }

  function resetProductForm() {
    setForm({ ...emptyProductForm })
    setImageFiles([])
    setServerImages([])
    setEditingProductId(null)
    setFileInputKey((k) => k + 1)
  }

  function startEditProduct(p) {
    setEditingProductId(p.id)
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      weight_gram: p.weight_gram > 0 ? p.weight_gram : 500,
      category_id: p.category_id || 0,
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        name: v.name || '',
        sku: v.sku || '',
        price: v.price > 0 ? v.price : Math.max(0, Number(p.price || 0) + Number(v.price_delta || 0)),
        stock: v.stock || 0,
        weight_gram: v.weight_gram > 0 ? v.weight_gram : 500,
      })),
    })
    setImageFiles([])
    setServerImages(
      productImagesSorted(p).map((x) => ({
        id: x.id,
        image_url: x.image_url,
      })),
    )
    setFileInputKey((k) => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startEditCategory(c) {
    setEditingCatId(c.id)
    setCatForm({ name: c.name || '', slug: c.slug || '' })
  }

  function onPickImages(e) {
    const picked = Array.from(e.target.files || []).filter((f) => f.size > 0)
    if (!picked.length) return
    setImageFiles((prev) => [...prev, ...picked])
    setFileInputKey((k) => k + 1)
  }

  function removeNewImageAt(idx) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateVariant(idx, patch) {
    setForm((prev) => ({
      ...prev,
      variants: (prev.variants || []).map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }))
  }

  function addVariant() {
    setForm((prev) => ({ ...prev, variants: [...(prev.variants || []), emptyVariant()] }))
  }

  function removeVariant(idx) {
    setForm((prev) => ({ ...prev, variants: (prev.variants || []).filter((_, i) => i !== idx) }))
  }

  async function removeServerImage(img) {
    if (!editingProductId) return
    setErr('')
    try {
      if (img.id) {
        const updated = await api('/api/admin/products/' + editingProductId + '/images/' + img.id, { method: 'DELETE' })
        setServerImages(
          productImagesSorted(updated).map((x) => ({
            id: x.id,
            image_url: x.image_url,
          })),
        )
        loadProducts()
      } else {
        setServerImages((prev) => prev.filter((x) => x.image_url !== img.image_url))
      }
    } catch (e) {
      setErr(e.message)
    }
  }

  async function saveProduct(e) {
    e.preventDefault()
    setErr('')
    if (!editingProductId && imageFiles.length < 1) {
      setErr('Produk baru: wajib unggah minimal satu file gambar (boleh beberapa sekaligus).')
      return
    }
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('description', form.description)
      fd.append('price', String(form.price))
      fd.append('stock', String(form.stock))
      fd.append('weight_gram', String(form.weight_gram || 500))
      fd.append('category_id', String(form.category_id))
      fd.append('variants', JSON.stringify((form.variants || []).filter((v) => String(v.name || '').trim())))
      imageFiles.forEach((f) => fd.append('images', f))
      if (editingProductId && serverImages.length === 0 && imageFiles.length === 0) {
        fd.append('remove_image', '1')
      }

      if (editingProductId) {
        await apiForm('/api/admin/products/' + editingProductId, fd, 'PUT')
        notify('Update berhasil')
      } else {
        await apiForm('/api/admin/products', fd, 'POST')
        notify('Produk berhasil ditambahkan')
      }
      resetProductForm()
      loadProducts()
    } catch (e) {
      setErr(e.message)
      notify(e.message, 'error')
    }
  }

  async function delProduct(id) {
    if (!confirm('Hapus produk? Produk tidak akan muncul lagi di daftar dan katalog.')) return
    setErr('')
    try {
      await api('/api/admin/products/' + id, { method: 'DELETE' })
      if (editingProductId === id) resetProductForm()
      loadProducts()
      notify('Produk berhasil dihapus')
    } catch (e) {
      setErr(e.message)
      notify(e.message, 'error')
    }
  }

  async function delCategory(id, name) {
    if (!confirm(`Hapus kategori "${name}"? Produk di kategori ini jadi tanpa kategori.`)) return
    setErr('')
    try {
      await api('/api/admin/categories/' + id, { method: 'DELETE' })
      if (editingCatId === id) {
        setEditingCatId(null)
        setCatForm({ name: '', slug: '' })
      }
      loadCategories()
      if (tab === 'products') loadProducts()
      notify('Kategori berhasil dihapus')
    } catch (e) {
      setErr(e.message)
      notify(e.message, 'error')
    }
  }

  async function saveCat(e) {
    e.preventDefault()
    setErr('')
    try {
      if (editingCatId) {
        await api('/api/admin/categories/' + editingCatId, {
          method: 'PUT',
          body: JSON.stringify(catForm),
        })
        notify('Update berhasil')
      } else {
        await api('/api/admin/categories', { method: 'POST', body: JSON.stringify(catForm) })
        notify('Kategori berhasil ditambahkan')
      }
      setCatForm({ name: '', slug: '' })
      setEditingCatId(null)
      loadCategories()
    } catch (e) {
      setErr(e.message)
      notify(e.message, 'error')
    }
  }

  async function setOrderStatus(id, status) {
    setErr('')
    const trackingNumber = String(trackingInputs[id] || '').trim()
    if (status === 'dikirim' && !trackingNumber) {
      const msg = 'Nomor resi wajib diisi saat status dikirim'
      setErr(msg)
      notify(msg, 'error')
      return
    }
    try {
      await api('/api/admin/orders/' + id + '/status', {
        method: 'PUT',
        body: JSON.stringify({ status, tracking_number: trackingNumber }),
      })
      loadOrders()
      notify('Status order berhasil diperbarui')
    } catch (e) {
      setErr(e.message)
      notify(e.message, 'error')
    }
  }

  const payLabel = (m) => {
    const x = (m || '').toLowerCase()
    if (x === 'cod') return 'COD'
    if (x === 'bank_transfer') return 'Transfer'
    if (x.startsWith('midtrans_va_')) return 'VA ' + x.replace('midtrans_va_', '').toUpperCase()
    if (x === 'midtrans_qris') return 'QRIS'
    if (x === 'midtrans_gopay') return 'GoPay'
    if (x === 'midtrans_shopeepay') return 'ShopeePay'
    if (x === 'midtrans_credit_card') return 'Kartu kredit'
    if (x === 'midtrans_cstore') return 'Convenience store'
    return 'Pembayaran online'
  }

  return (
    <div className="animate-fade-in">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Panel</p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">Dashboard Admin</h1>
          {user && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Halo, <span className="font-semibold text-slate-900 dark:text-slate-100">{customerName(user)}</span>
            </p>
          )}
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {tab === 'products' && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start">
          <form onSubmit={saveProduct} className="card-elevated space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingProductId ? `Edit produk #${editingProductId}` : 'Tambah produk'}
              </h2>
              {editingProductId && (
                <button type="button" className="btn-secondary text-xs" onClick={resetProductForm}>
                  Batal edit
                </button>
              )}
            </div>
            <div>
              <label htmlFor="p-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nama produk
              </label>
              <input
                id="p-name"
                className="input-field"
                placeholder="Contoh: Kemeja linen"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="p-desc" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Deskripsi
              </label>
              <textarea
                id="p-desc"
                className="input-field min-h-[100px] resize-y"
                placeholder="Spesifikasi singkat untuk pembeli"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-price" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Harga <span className="text-emerald-700 dark:text-emerald-400">(IDR / Rupiah)</span>
                </label>
                <input
                  id="p-price"
                  type="number"
                  min={0}
                  className="input-field"
                  placeholder="99000"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Isi angka bulat <strong className="text-slate-600 dark:text-slate-400">tanpa titik atau koma</strong>. Contoh: untuk Rp 99.000 ketik{' '}
                  <code className="rounded bg-slate-100 px-1 text-slate-800 dark:bg-slate-800 dark:text-slate-200">99000</code>.
                </p>
              </div>
              <div>
                <label htmlFor="p-stock" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Stok <span className="text-emerald-700 dark:text-emerald-400">(jumlah unit)</span>
                </label>
                <input
                  id="p-stock"
                  type="number"
                  min={0}
                  className="input-field"
                  placeholder="10"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Banyaknya barang fisik yang <strong className="text-slate-600 dark:text-slate-400">siap dijual</strong> (per potong / per buah / per paket).
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="p-weight" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Berat per unit <span className="text-emerald-700 dark:text-emerald-400">(gram, ongkir)</span>
              </label>
              <input
                id="p-weight"
                type="number"
                min={1}
                className="input-field max-w-[12rem]"
                value={form.weight_gram || 500}
                onChange={(e) => setForm({ ...form, weight_gram: Number(e.target.value) || 500 })}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Total berat = berat x qty keranjang untuk perhitungan ongkir.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Varian produk</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Contoh: ukuran, warna, paket. Tiap varian punya harga, jumlah, dan berat sendiri.</p>
                </div>
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={addVariant}>
                  Tambah varian
                </button>
              </div>
              {(form.variants || []).length > 0 && (
                <div className="mt-4 space-y-3">
                  {form.variants.map((v, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
                      <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Varian #{idx + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nama varian #{idx + 1}</span>
                          <input className="input-field" placeholder="Contoh: Merah / XL / Paket A" value={v.name} onChange={(e) => updateVariant(idx, { name: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">SKU varian #{idx + 1}</span>
                          <input className="input-field" placeholder="Opsional, contoh: KJ-XL-MRH" value={v.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Harga varian #{idx + 1}</span>
                          <input type="number" min={0} className="input-field" placeholder="Harga varian ini, contoh: 99000" value={v.price} onChange={(e) => updateVariant(idx, { price: Number(e.target.value) || 0 })} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Jumlah stok varian #{idx + 1}</span>
                          <input type="number" min={0} className="input-field" placeholder="Jumlah varian ini, contoh: 10" value={v.stock} onChange={(e) => updateVariant(idx, { stock: Number(e.target.value) || 0 })} />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Berat varian #{idx + 1}</span>
                          <input type="number" min={1} className="input-field" placeholder="Berat varian ini dalam gram, contoh: 500" value={v.weight_gram || 500} onChange={(e) => updateVariant(idx, { weight_gram: Number(e.target.value) || 500 })} />
                        </label>
                      </div>
                      <button type="button" className="btn-danger mt-3 px-3 py-1.5 text-xs" onClick={() => removeVariant(idx)}>
                        Hapus varian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Foto produk <span className="text-amber-700">(upload file, boleh banyak)</span>
              </label>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Format: JPG, PNG, WebP, atau GIF. Maksimal 5 MB per file. Tambah beberapa kali jika perlu. Hapus per gambar lewat tombol ×
                pada thumbnail.
              </p>
              <input
                key={fileInputKey}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100 dark:file:bg-emerald-950/50 dark:file:text-emerald-200 dark:hover:file:bg-emerald-900/60"
                onChange={onPickImages}
              />
              {!editingProductId && (
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200/90">
                  Produk baru: unggah minimal satu gambar sebelum simpan.
                </p>
              )}
              {editingProductId && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Edit: tambah gambar dengan pilih file lagi; hapus salah satu dengan ×; simpan untuk mengunggah file baru. Gambar yang sudah
                  tersimpan terhapus langsung saat Anda klik ×.
                </p>
              )}
              {(serverImages.length > 0 || imageFiles.length > 0) && (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {serverImages.map((img) => (
                    <li
                      key={img.id ?? img.image_url}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-800"
                    >
                      <img src={mediaUrl(img.image_url)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        title="Hapus gambar"
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/75 text-sm font-bold text-white shadow hover:bg-red-600"
                        onClick={() => removeServerImage(img)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {imageFiles.map((f, idx) => (
                    <li key={f.name + idx} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-100">
                      <img src={blobPreviews[idx] || ''} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-emerald-800/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                        Baru
                      </span>
                      <button
                        type="button"
                        title="Buang dari daftar unggah"
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/75 text-sm font-bold text-white shadow hover:bg-red-600"
                        onClick={() => removeNewImageAt(idx)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="p-cat" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Kategori
              </label>
              <select
                id="p-cat"
                className="input-field"
                value={form.category_id || ''}
                onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full py-3">
              {editingProductId ? 'Perbarui produk' : 'Simpan produk'}
            </button>
          </form>

          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900 dark:text-slate-100">Daftar produk</h2>
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-soft-dark sm:gap-3 sm:p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {productPrimaryUrl(p) ? (
                      <img
                        src={mediaUrl(productPrimaryUrl(p))}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-100 dark:ring-slate-700"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        —
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">{formatIDR(p.price)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                    <button type="button" className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs" onClick={() => startEditProduct(p)}>
                      Edit
                    </button>
                    <button type="button" className="btn-danger px-3 py-1.5 text-xs" onClick={() => delProduct(p.id)}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <form onSubmit={saveCat} className="card-elevated space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingCatId ? `Edit kategori #${editingCatId}` : 'Tambah kategori'}
              </h2>
              {editingCatId && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setEditingCatId(null)
                    setCatForm({ name: '', slug: '' })
                  }}
                >
                  Batal edit
                </button>
              )}
            </div>
            <input
              className="input-field"
              placeholder="Nama"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              required
            />
            <input
              className="input-field"
              placeholder="Slug (opsional)"
              value={catForm.slug}
              onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
            />
            <button type="submit" className="btn-primary w-full py-3">
              {editingCatId ? 'Perbarui kategori' : 'Simpan kategori'}
            </button>
          </form>
          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900 dark:text-slate-100">Daftar kategori</h2>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-soft-dark"
                >
                  <span className="min-w-0 font-medium text-slate-900 dark:text-slate-100">
                    {c.name} <span className="font-normal text-slate-400 dark:text-slate-500">({c.slug})</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => startEditCategory(c)}>
                      Edit
                    </button>
                    <button type="button" className="btn-danger px-3 py-1.5 text-xs" onClick={() => delCategory(c.id, c.name)}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-6 space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card-elevated text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-bold text-slate-900 dark:text-slate-100">#{o.id}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(o.status)}`}>
                  {statusLabel(o.status)}
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{customerName(o.user)}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{o.user?.email}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Bayar: <span className="font-medium text-slate-700 dark:text-slate-300">{payLabel(o.payment_method)}</span>
              </p>
              <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">{formatIDR(o.total)}</p>
              <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Chat pesanan</p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {customerName(o.user)} menanyakan {orderSummary(o)}
                </p>
                <Link to={`/admin/chat?order_id=${o.id}`} className="btn-secondary mt-3 inline-flex px-3 py-1.5 text-xs">
                  Buka chat
                </Link>
              </div>
              {(o.shipping_address || o.shipping_city) && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Kirim ke</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{o.ship_to_name}</p>
                  <p className="text-slate-600 dark:text-slate-400">{o.shipping_phone}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{o.shipping_address}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {[o.shipping_city, o.shipping_province].filter(Boolean).join(', ')} {o.shipping_postal_code || ''}
                  </p>
                  {(o.courier || o.shipping_service) && (
                    <p className="mt-1 text-slate-500">
                      {o.courier?.toUpperCase()} {o.shipping_service}
                      {(o.shipping_cost ?? 0) > 0 && <> · Ongkir {formatIDR(o.shipping_cost)}</>}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                <label htmlFor={`tracking-${o.id}`} className="block font-semibold text-slate-800 dark:text-slate-200">
                  Nomor resi
                </label>
                <input
                  id={`tracking-${o.id}`}
                  className="input-field mt-2 py-2 text-sm"
                  value={trackingInputs[o.id] ?? o.tracking_number ?? ''}
                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  placeholder="Masukkan nomor resi sebelum status dikirim"
                />
                {o.tracking_number && (
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Tersimpan: <span className="font-medium text-slate-700 dark:text-slate-300">{o.tracking_number}</span>
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={'/admin/orders/' + o.id + '/print'}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  Cetak kiriman
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!adminCanSetStatus(o, s)}
                    title={adminStatusTitle(o, s)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-600/50 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 dark:disabled:hover:border-slate-600 dark:disabled:hover:bg-slate-800 dark:disabled:hover:text-slate-300"
                    onClick={() => setOrderStatus(o.id, s)}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sales' && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
            <div>
              <label htmlFor="sales-from" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Dari
              </label>
              <input
                id="sales-from"
                type="date"
                className="input-field w-auto"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="sales-to" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Sampai
              </label>
              <input
                id="sales-to"
                type="date"
                className="input-field w-auto"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
              />
            </div>
            <button type="button" className="btn-primary" onClick={() => loadSales()}>
              Perbarui
            </button>
          </div>

          {!sales && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Memuat…</p>
          )}

          {sales && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Periode: <span className="font-medium text-slate-800 dark:text-slate-200">{sales.from}</span> —{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">{sales.to}</span>
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="card-elevated">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Pendapatan diproses</p>
                  <p className="mt-2 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatIDR(sales.paid_revenue ?? 0)}
                  </p>
                </div>
                <div className="card-elevated">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Order diproses</p>
                  <p className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {sales.paid_orders ?? 0}
                  </p>
                </div>
                <div className="card-elevated">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Order menunggu</p>
                  <p className="mt-2 font-display text-2xl font-bold text-amber-800 dark:text-amber-200">
                    {sales.pending_orders ?? 0}
                  </p>
                </div>
              </div>
              <SalesChart rows={sales.daily || []} />
              <div className="card-elevated overflow-x-auto p-0 sm:p-0">
                <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                  Rincian per hari
                </h2>
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">Order</th>
                      <th className="px-5 py-3">Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sales.daily || []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                          Tidak ada penjualan lunas di periode ini.
                        </td>
                      </tr>
                    )}
                    {(sales.daily || []).map((row) => (
                      <tr
                        key={row.day}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{row.day}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{row.orders}</td>
                        <td className="px-5 py-3 font-medium text-emerald-700 dark:text-emerald-400">
                          {formatIDR(row.revenue ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
