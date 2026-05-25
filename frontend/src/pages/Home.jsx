import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { mediaUrl, productPrimaryUrl } from '../media.js'

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function variantPrice(product, variant) {
  const price = Number(variant?.price || 0)
  if (price > 0) return price
  return Math.max(0, Number(product?.price || 0) + Number(variant?.price_delta || 0))
}

function catalogSummary(product) {
  const variants = Array.isArray(product.variants) ? product.variants : []
  if (!variants.length) {
    return { price: Number(product.price || 0), stock: Number(product.stock || 0), hasVariants: false }
  }
  const prices = variants.map((v) => variantPrice(product, v))
  return {
    price: Math.min(...prices),
    stock: variants.reduce((sum, v) => sum + Number(v.stock || 0), 0),
    hasVariants: true,
  }
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-soft-dark">
      <div className="aspect-[4/3] skeleton" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-4 w-1/2 skeleton" />
      </div>
    </div>
  )
}

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [cat, setCat] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/categories')
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setErr('')
    setLoading(true)
    const q = cat ? `?category_id=${encodeURIComponent(cat)}` : ''
    api('/api/products' + q)
      .then(setProducts)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [cat])

  return (
    <div className="animate-fade-in">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/85 p-6 shadow-card ring-1 ring-slate-900/[0.03] backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70 dark:shadow-card-dark dark:ring-white/[0.04] sm:mb-10 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/25" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/15" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/15" />
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 sm:text-sm">Katalog</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
          Belanja{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
            modern
          </span>
          <br className="sm:hidden" />
          <span className="text-slate-800 dark:text-slate-300"> & praktis</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          Produk pilihan single-vendor. Checkout aman dengan pembayaran online.
        </p>
      </section>

      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
        <button
          type="button"
          onClick={() => setCat('')}
          className={`chip ${!cat ? 'chip-active' : 'chip-inactive'}`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(String(c.id))}
            className={`chip ${cat === String(c.id) ? 'chip-active' : 'chip-inactive'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 xs:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xs:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const summary = catalogSummary(p)
            return (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/50 hover:shadow-glow dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-soft-dark dark:hover:border-emerald-500/40 dark:hover:shadow-glow-dark"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
                  {productPrimaryUrl(p) ? (
                    <img
                      src={mediaUrl(productPrimaryUrl(p))}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                      Tanpa gambar
                    </div>
                  )}
                  {summary.stock <= 5 && summary.stock > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm sm:text-xs">
                      Stok terbatas
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h2 className="line-clamp-2 font-semibold leading-snug text-slate-900 transition group-hover:text-emerald-800 dark:text-slate-100 dark:group-hover:text-emerald-300">
                    {p.name}
                  </h2>
                  <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-400 sm:text-xl">
                    {summary.hasVariants ? 'Mulai ' : ''}
                    {formatIDR(summary.price)}
                  </p>
                  <p className="mt-auto pt-2 text-xs text-slate-500 dark:text-slate-400">Stok {summary.stock}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && products.length === 0 && !err && (
        <div className="card-elevated py-12 text-center text-slate-600 dark:text-slate-400">
          <p className="font-medium text-slate-800 dark:text-slate-200">Belum ada produk di kategori ini.</p>
          <button type="button" className="btn-ghost mt-2 text-emerald-700 dark:text-emerald-400" onClick={() => setCat('')}>
            Lihat semua
          </button>
        </div>
      )}
    </div>
  )
}
