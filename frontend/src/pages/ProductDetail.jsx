import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import { mediaUrl, productImagesSorted } from '../media.js'
import { getCart, setCart } from '../cartStore.js'
import { useAuth } from '../auth.jsx'

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function variantPrice(product, variant) {
  if (!variant) return Math.max(0, Number(product?.price || 0))
  const price = Number(variant.price || 0)
  if (price > 0) return price
  return Math.max(0, Number(product?.price || 0) + Number(variant.price_delta || 0))
}

function displayVariantPrice(product, variants, selectedVariant) {
  if (selectedVariant) return variantPrice(product, selectedVariant)
  if (!variants.length) return variantPrice(product, null)
  return Math.min(...variants.map((v) => variantPrice(product, v)))
}

export default function ProductDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [p, setP] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [variantId, setVariantId] = useState('')

  useEffect(() => {
    setLoading(true)
    setP(null)
    setMsg('')
    api('/api/products/' + id)
      .then(setP)
      .catch(() => setP(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setActiveImg(0)
    setVariantId('')
  }, [id])

  function addToCart() {
    if (!user) {
      setMsg('Silakan masuk untuk menambah ke keranjang.')
      return
    }
    if (!p || qty < 1) return
    const variants = Array.isArray(p.variants) ? p.variants : []
    const variant = variants.find((v) => String(v.id) === String(variantId))
    if (variants.length && !variant) {
      setMsg('Pilih varian produk terlebih dahulu.')
      return
    }
    const currentStock = variant ? variant.stock : p.stock
    if (currentStock < qty) {
      setMsg('Stok tidak cukup.')
      return
    }
    const unitPrice = variantPrice(p, variant)
    const cart = getCart()
    const i = cart.findIndex((l) => l.product_id === p.id && String(l.variant_id || '') === String(variant?.id || ''))
    if (i >= 0) cart[i].qty += qty
    else cart.push({ product_id: p.id, variant_id: variant?.id || 0, variant_name: variant?.name || '', qty, name: p.name, price: unitPrice })
    setCart(cart)
    setMsg('Ditambahkan ke keranjang.')
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-4 h-4 w-24 skeleton" />
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="aspect-square max-h-[min(100vw,28rem)] skeleton rounded-3xl lg:mx-0" />
          <div className="space-y-4">
            <div className="h-10 w-4/5 skeleton" />
            <div className="h-8 w-1/3 skeleton" />
            <div className="h-24 w-full skeleton" />
          </div>
        </div>
      </div>
    )
  }

  if (!p) {
    return (
      <div className="card-elevated py-12 text-center animate-fade-in">
        <p className="text-slate-600 dark:text-slate-400">Produk tidak ditemukan.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Kembali ke katalog
        </Link>
      </div>
    )
  }

  const gallery = productImagesSorted(p)
  const imgIdx = gallery.length ? Math.min(activeImg, gallery.length - 1) : 0
  const mainSrc = gallery[imgIdx]?.image_url ? mediaUrl(gallery[imgIdx].image_url) : ''
  const reviews = p.reviews || []
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length : 0
  const variants = Array.isArray(p.variants) ? p.variants : []
  const selectedVariant = variants.find((v) => String(v.id) === String(variantId))
  const displayPrice = displayVariantPrice(p, variants, selectedVariant)
  const displayStock = selectedVariant ? selectedVariant.stock : p.stock
  const displayWeight = selectedVariant ? selectedVariant.weight_gram || 500 : p.weight_gram || 500

  return (
    <div className="animate-fade-in pb-24 lg:pb-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        <span aria-hidden>←</span> Katalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-100 to-white shadow-card dark:border-slate-700/70 dark:from-slate-800 dark:to-slate-950 dark:shadow-card-dark lg:sticky lg:top-24">
          <div className="aspect-square max-h-[min(92vw,32rem)] sm:max-h-none">
            {mainSrc ? (
              <img src={mainSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400 dark:text-slate-500">Tanpa gambar</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 border-t border-slate-200/60 bg-white/90 p-3 dark:border-slate-700/60 dark:bg-slate-900/95">
              {gallery.map((im, i) => (
                <button
                  key={im.id ?? im.image_url + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-16 ${
                    imgIdx === i
                      ? 'ring-emerald-600 dark:ring-emerald-400'
                      : 'ring-transparent hover:ring-slate-300 dark:hover:ring-slate-500'
                  }`}
                >
                  <img src={mediaUrl(im.image_url)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {p.category?.name && (
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/80">
              {p.category.name}
            </span>
          )}
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
            {p.name}
          </h1>
          <p className="mt-4 text-2xl font-bold text-emerald-700 dark:text-emerald-400 sm:text-3xl">{formatIDR(displayPrice)}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${
                displayStock > 10
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : displayStock > 0
                    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              Stok: {displayStock}
            </span>
          </div>

          {variants.length > 0 && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Varian</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {variants.map((v) => {
                  return (
                    <label
                      key={v.id}
                      className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                        String(variantId) === String(v.id)
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60'
                      } ${v.stock < 1 ? 'opacity-55' : ''}`}
                    >
                      <input
                        type="radio"
                        name="variant"
                        value={v.id}
                        checked={String(variantId) === String(v.id)}
                        disabled={v.stock < 1}
                        onChange={() => setVariantId(String(v.id))}
                        className="sr-only"
                      />
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">{v.name}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Deskripsi</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
              {p.description || '—'}
            </p>
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">Berat per unit: {displayWeight} gram</p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ulasan</p>
              {reviews.length > 0 && (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {avgRating.toFixed(1)} / 5 dari {reviews.length} ulasan
                </p>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada ulasan.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {[r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ').trim() || r.user?.email || 'Customer'}
                      </p>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">{r.rating} / 5</p>
                    </div>
                    {r.comment && <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 hidden flex-wrap items-end gap-4 sm:flex">
            <div>
              <label htmlFor="qty" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Jumlah
              </label>
              <input
                id="qty"
                type="number"
                min={1}
                max={displayStock}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(displayStock, Number(e.target.value) || 1)))}
                className="input-field max-w-[6rem] text-center"
              />
            </div>
            <button
              type="button"
              onClick={addToCart}
              disabled={displayStock < 1 || (variants.length > 0 && !selectedVariant)}
              className="btn-primary min-h-[46px] min-w-[180px] disabled:opacity-40"
            >
              Tambah ke keranjang
            </button>
            {user && (
              <Link to={`/chat?product_id=${p.id}`} className="btn-secondary min-h-[46px]">
                Tanya admin
              </Link>
            )}
          </div>

          {msg && (
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                msg.includes('masuk')
                  ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900/40'
                  : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900/40'
              }`}
            >
              {msg}
              {msg.includes('masuk') && (
                <>
                  {' '}
                  <Link to="/login" className="font-semibold underline">
                    Masuk
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 p-3 shadow-[0_-8px_30px_rgb(0_0_0/0.08)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/95 dark:shadow-[0_-8px_30px_rgb(0_0_0/0.4)] sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {user && (
            <Link to={`/chat?product_id=${p.id}`} className="btn-secondary min-h-[44px] shrink-0 px-3 py-2.5 text-sm">
              Chat
            </Link>
          )}
          <input
            type="number"
            min={1}
            max={displayStock}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(displayStock, Number(e.target.value) || 1)))}
            className="input-field max-w-[4.5rem] shrink-0 py-2 text-center text-base"
          />
          <button
            type="button"
            onClick={addToCart}
            disabled={displayStock < 1 || (variants.length > 0 && !selectedVariant)}
            className="btn-primary min-h-[44px] flex-1 py-2.5 text-base disabled:opacity-40"
          >
            + Keranjang
          </button>
        </div>
      </div>
    </div>
  )
}
