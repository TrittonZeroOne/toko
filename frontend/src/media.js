/** Daftar gambar produk terurut (galeri); fallback ke `image_url` jika belum ada baris `images`. */
export function productImagesSorted(p) {
  if (!p) return []
  const raw = Array.isArray(p.images) ? [...p.images] : []
  if (raw.length) {
    return raw.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || (Number(a.id) || 0) - (Number(b.id) || 0),
    )
  }
  if (p.image_url) return [{ id: undefined, image_url: p.image_url }]
  return []
}

/** Gambar utama untuk kartu katalog / daftar admin. */
export function productPrimaryUrl(p) {
  const xs = productImagesSorted(p)
  return xs[0]?.image_url || ''
}

/** URL gambar produk: path /uploads/... di dev lewat proxy Vite; production pakai VITE_API_URL. */
export function mediaUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (base) return base + path
  return path
}
