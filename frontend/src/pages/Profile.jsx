import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [shipCfg, setShipCfg] = useState(null)
  const [districts, setDistricts] = useState([])
  const [subdistricts, setSubdistricts] = useState([])

  const shippingReady = shipCfg !== null
  const binderActive = shippingReady && shipCfg.api_configured

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    postal_code: '',
    province_id: '',
    city_id: '',
    district_id: '',
    district_name: '',
    subdistrict_id: '',
    subdistrict_name: '',
    province_name: '',
    city_name: '',
  })

  const [pw, setPw] = useState({ current: '', next: '', next2: '' })

  useEffect(() => {
    if (!user) return
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      address: user.address || '',
      postal_code: user.postal_code || '',
      province_id: user.province_id || '',
      city_id: user.city_id || '',
      district_id: user.district_id || '',
      district_name: user.district_name || '',
      subdistrict_id: user.subdistrict_id || '',
      subdistrict_name: user.subdistrict_name || '',
      province_name: user.province_name || '',
      city_name: user.city_name || '',
    })
  }, [user])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api('/api/shipping/config')
        if (cancelled) return
        setShipCfg(cfg)
        try {
          const list = await api('/api/shipping/provinces')
          if (!cancelled) setProvinces(Array.isArray(list) ? list : [])
        } catch {
          if (!cancelled) setProvinces([])
        }
      } catch {
        if (!cancelled) {
          setShipCfg({ provider: 'binderbyte', api_configured: false })
          try {
            const list = await api('/api/shipping/provinces')
            if (!cancelled) setProvinces(Array.isArray(list) ? list : [])
          } catch {
            if (!cancelled) setProvinces([])
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const cid = form.city_id
    if (!cid || !binderActive) {
      setDistricts([])
      return
    }
    let cancelled = false
    api('/api/shipping/districts?city_id=' + encodeURIComponent(cid))
      .then((list) => {
        if (!cancelled) setDistricts(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setDistricts([])
      })
    return () => {
      cancelled = true
    }
  }, [form.city_id, binderActive])

  useEffect(() => {
    const did = form.district_id
    if (!did || !binderActive) {
      setSubdistricts([])
      return
    }
    let cancelled = false
    api('/api/shipping/subdistricts?district_id=' + encodeURIComponent(did))
      .then((list) => {
        if (!cancelled) setSubdistricts(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setSubdistricts([])
      })
    return () => {
      cancelled = true
    }
  }, [form.district_id, binderActive])

  useEffect(() => {
    const pid = form.province_id
    if (!pid) {
      setCities([])
      return
    }
    let cancelled = false
    setLoadingGeo(true)
    ;(async () => {
      try {
        const list = await api('/api/shipping/cities?province_id=' + encodeURIComponent(pid))
        if (!cancelled) setCities(Array.isArray(list) ? list : [])
      } catch {
        if (!cancelled) setCities([])
      } finally {
        if (!cancelled) setLoadingGeo(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form.province_id])

  async function saveProfile(e) {
    e.preventDefault()
    setErr('')
    setOk('')
    try {
      const u = await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setUser(u)
      setOk('Profil disimpan.')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setErr('')
    setOk('')
    if (pw.next !== pw.next2) {
      setErr('Konfirmasi kata sandi baru tidak sama.')
      return
    }
    try {
      await api('/api/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: pw.current, new_password: pw.next }),
      })
      setPw({ current: '', next: '', next2: '' })
      setOk('Kata sandi diperbarui.')
    } catch (e) {
      setErr(e.message)
    }
  }

  function onProvinceChange(e) {
    const pid = e.target.value
    const name =
      provinces.find((p) => String(p.province_id) === String(pid))?.province || ''
    setForm((f) => ({
      ...f,
      province_id: pid,
      province_name: name,
      city_id: '',
      city_name: '',
      district_id: '',
      district_name: '',
      subdistrict_id: '',
      subdistrict_name: '',
    }))
  }

  function onCityChange(e) {
    const cid = e.target.value
    const row = cities.find((c) => String(c.city_id) === String(cid))
    setForm((f) => ({
      ...f,
      city_id: cid,
      city_name: row ? `${row.type || ''} ${row.city_name || ''}`.trim() : '',
      district_id: '',
      district_name: '',
      subdistrict_id: '',
      subdistrict_name: '',
    }))
  }

  function onDistrictChange(e) {
    const id = e.target.value
    const row = districts.find((d) => String(d.district_id) === String(id))
    setForm((f) => ({
      ...f,
      district_id: id,
      district_name: row?.district_name || '',
      subdistrict_id: '',
      subdistrict_name: '',
      postal_code:
        row?.zip_code && String(row.zip_code).trim() && String(row.zip_code).trim() !== '0'
          ? String(row.zip_code)
          : f.postal_code,
    }))
  }

  function onSubdistrictChange(e) {
    const id = e.target.value
    const row = subdistricts.find((s) => String(s.subdistrict_id) === String(id))
    setForm((f) => ({
      ...f,
      subdistrict_id: id,
      subdistrict_name: row?.subdistrict_name || '',
      postal_code: row?.zip_code ? String(row.zip_code) : f.postal_code,
    }))
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Profil</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Data diri, alamat pengiriman, dan keamanan akun.</p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}
      {ok && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          {ok}
        </div>
      )}

      <form onSubmit={saveProfile} className="card-elevated mt-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Data & alamat</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama depan</label>
            <input className="input-field" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama belakang</label>
            <input className="input-field" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nomor HP / WhatsApp</label>
          <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08…" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Alamat lengkap</label>
          <textarea
            className="input-field min-h-[88px] resize-y"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Jalan, RT/RW, kelurahan…"
          />
        </div>
        {!shippingReady && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat pengaturan wilayah…</p>
        )}
        {shippingReady && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p>Pilih wilayah pengiriman dari provinsi sampai kelurahan.</p>
              {!shipCfg.api_configured && (
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Layanan wilayah belum aktif. Atur API ongkir di backend lalu restart server.
                </p>
              )}
              {shipCfg.api_configured && provinces.length === 0 && (
                <p className="font-medium text-red-700 dark:text-red-300">
                  Daftar provinsi gagal dimuat — periksa API key, koneksi internet, atau log backend.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Provinsi</label>
              <select className="input-field" value={form.province_id} onChange={onProvinceChange}>
                <option value="">Pilih provinsi</option>
                {provinces.map((p) => (
                  <option key={p.province_id} value={p.province_id}>
                    {p.province}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kabupaten / Kota</label>
              <select
                className="input-field"
                disabled={!form.province_id || loadingGeo}
                value={form.city_id}
                onChange={onCityChange}
              >
                <option value="">{loadingGeo ? 'Memuat…' : form.province_id ? 'Pilih kab/kota' : '—'}</option>
                {cities.map((c) => (
                  <option key={c.city_id} value={c.city_id}>
                    {c.type ? `${c.type} ` : ''}
                    {c.city_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kecamatan</label>
              <select className="input-field" value={form.district_id} onChange={onDistrictChange} disabled={!form.city_id}>
                <option value="">{form.city_id ? 'Pilih kecamatan' : '—'}</option>
                {districts.map((d) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.district_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Kelurahan / Desa {subdistricts.length === 0 && form.district_id ? '(opsional)' : ''}
              </label>
              <select
                className="input-field"
                value={form.subdistrict_id}
                onChange={onSubdistrictChange}
                disabled={!form.district_id || subdistricts.length === 0}
              >
                <option value="">
                  {!form.district_id ? '—' : subdistricts.length === 0 ? 'Tidak ada daftar kelurahan' : 'Pilih kelurahan'}
                </option>
                {subdistricts.map((s) => (
                  <option key={s.subdistrict_id} value={s.subdistrict_id}>
                    {s.subdistrict_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kode pos</label>
          <input className="input-field" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary w-full py-3">
          Simpan profil
        </button>
      </form>

      <form onSubmit={savePassword} className="card-elevated mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Ubah kata sandi</h2>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kata sandi saat ini</label>
          <input
            type="password"
            className="input-field"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kata sandi baru</label>
          <input
            type="password"
            className="input-field"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ulangi kata sandi baru</label>
          <input
            type="password"
            className="input-field"
            autoComplete="new-password"
            value={pw.next2}
            onChange={(e) => setPw({ ...pw, next2: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-secondary w-full py-3">
          Perbarui kata sandi
        </button>
      </form>
    </div>
  )
}
