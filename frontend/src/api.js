const prefix = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function api(path, options = {}) {
  const url = `${prefix}${path}`
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.error || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

/** multipart/form-data (tanpa Content-Type: application/json) */
export async function apiForm(path, formData, method = 'POST') {
  const url = `${prefix}${path}`
  const headers = {}
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method, headers, body: formData })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.error || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}
