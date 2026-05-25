const KEY = 'toko_cart'

export function getCart() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** @typedef {{ product_id: number, variant_id?: number, variant_name?: string, qty: number, name?: string, price?: number }} CartLine */

/** @param {CartLine[]} lines */
export function setCart(lines) {
  localStorage.setItem(KEY, JSON.stringify(lines))
}

export function cartCount() {
  return getCart().reduce((a, l) => a + l.qty, 0)
}
