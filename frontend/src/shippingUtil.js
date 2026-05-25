/** Slug lokasi untuk Binderbyte cost API (sama dengan backend CityNameToBinderSlug). */
export function binderCitySlug(name) {
  if (!name || typeof name !== 'string') return ''
  let u = name.trim().toUpperCase()
  for (const p of ['KAB.', 'KAB ', 'KOTA ']) {
    if (u.startsWith(p)) {
      u = u.slice(p.length).trim()
      break
    }
  }
  let out = ''
  for (const ch of u.toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) out += ch
  }
  return out
}

export function binderLocationSlug({ subdistrictName = '', districtName = '', cityName = '' } = {}) {
  const city = binderCitySlug(cityName)
  if (!city) return ''
  const area = binderCitySlug(subdistrictName) || binderCitySlug(districtName)
  return area ? `${area},${city}` : city
}
