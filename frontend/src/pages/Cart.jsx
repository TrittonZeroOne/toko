import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCart, setCart } from '../cartStore.js'

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function Cart() {
  const [, bump] = useState(0)
  const lines = getCart()

  const total = useMemo(
    () => lines.reduce((a, l) => a + (l.price || 0) * l.qty, 0),
    [lines],
  )

  function refresh() {
    bump((x) => x + 1)
  }

  function updateQty(productId, variantId, qty) {
    const cart = getCart()
    const i = cart.findIndex((l) => l.product_id === productId && String(l.variant_id || '') === String(variantId || ''))
    if (i < 0) return
    if (qty < 1) cart.splice(i, 1)
    else cart[i].qty = qty
    setCart(cart)
    refresh()
  }

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in text-center">
        <div className="card-elevated py-14 sm:py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800">
            🛒
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Keranjang kosong</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">Yuk mulai tambahkan produk favorit Anda.</p>
          <Link to="/" className="btn-primary mt-8 inline-flex px-8">
            Jelajahi katalog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Keranjang</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{lines.length} jenis barang</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3 lg:items-start">
        <ul className="space-y-3 lg:col-span-2">
          {lines.map((l) => (
            <li
              key={`${l.product_id}:${l.variant_id || ''}`}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft transition hover:border-slate-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-soft-dark dark:hover:border-slate-600 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{l.name || 'Produk #' + l.product_id}</p>
                {l.variant_name && <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Varian: {l.variant_name}</p>}
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatIDR(l.price || 0)} <span className="text-slate-400 dark:text-slate-500">×</span> {l.qty}
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{formatIDR((l.price || 0) * l.qty)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <input
                  type="number"
                  min={1}
                  className="input-field max-w-[5rem] py-2 text-center"
                  value={l.qty}
                  onChange={(e) => updateQty(l.product_id, l.variant_id, Number(e.target.value) || 1)}
                />
                <button type="button" className="btn-danger shrink-0" onClick={() => updateQty(l.product_id, l.variant_id, 0)}>
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24">
          <div className="card-elevated border-emerald-100/80 bg-gradient-to-b from-white to-emerald-50/30 dark:border-emerald-900/30 dark:from-slate-900 dark:to-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ringkasan</p>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700/80">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total</span>
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(total)}</span>
            </div>
            <Link to="/checkout" className="btn-primary mt-5 block w-full py-3 text-center text-base">
              Checkout
            </Link>
            <Link to="/" className="mt-3 block text-center text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Lanjut belanja
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
