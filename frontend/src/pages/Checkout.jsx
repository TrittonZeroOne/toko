import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { getCart, setCart } from '../cartStore.js'
import { useAuth } from '../auth.jsx'
import { binderCitySlug, binderLocationSlug } from '../shippingUtil.js'

const PAYMENT_OPTIONS = [
  {
    id: 'midtrans_va_bca',
    title: 'Virtual Account BCA',
    desc: 'Kode pembayaran VA BCA.',
  },
  {
    id: 'midtrans_va_bni',
    title: 'Virtual Account BNI',
    desc: 'Kode pembayaran VA BNI.',
  },
  {
    id: 'midtrans_va_bri',
    title: 'Virtual Account BRI',
    desc: 'Kode pembayaran VA BRI.',
  },
  {
    id: 'midtrans_va_mandiri',
    title: 'Mandiri Bill Payment',
    desc: 'Pembayaran Mandiri Bill.',
  },
  {
    id: 'midtrans_va_permata',
    title: 'Virtual Account Permata',
    desc: 'Kode pembayaran VA Permata.',
  },
  {
    id: 'midtrans_qris',
    title: 'QRIS',
    desc: 'Pembayaran QRIS.',
  },
  {
    id: 'midtrans_gopay',
    title: 'GoPay',
    desc: 'Pembayaran GoPay.',
  },
  {
    id: 'midtrans_shopeepay',
    title: 'ShopeePay',
    desc: 'Pembayaran ShopeePay.',
  },
  {
    id: 'midtrans_credit_card',
    title: 'Kartu kredit',
    desc: 'Pembayaran kartu kredit.',
  },
  {
    id: 'midtrans_cstore',
    title: 'Alfamart/Indomart',
    desc: 'Pembayaran gerai ritel.',
  },
  {
    id: 'bank_transfer',
    title: 'Transfer bank manual',
    desc: 'Transfer ke rekening toko; admin memverifikasi manual.',
  },
  {
    id: 'cod',
    title: 'COD — bayar di tempat',
    desc: 'Bayar tunai kepada kurir saat barang diterima.',
  },
]

const COURIERS = [
  { id: 'jne', label: 'JNE' },
  { id: 'sicepat', label: 'SiCepat' },
  { id: 'anteraja', label: 'AnterAja' },
  { id: 'pos', label: 'POS Indonesia' },
  { id: 'lion', label: 'Lion Parcel' },
  { id: 'sap', label: 'SAP Express' },
  { id: 'ide', label: 'ID Express' },
  { id: 'ninja', label: 'Ninja Xpress' },
]

const money = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)

const PAYMENT_LOGOS = {
  midtrans_va_bca: ['bca.svg'],
  midtrans_va_bni: ['bni.svg'],
  midtrans_va_bri: ['bri.svg'],
  midtrans_va_mandiri: ['mandiri.svg'],
  midtrans_va_permata: ['permata.svg'],
  midtrans_qris: ['qris.svg'],
  midtrans_gopay: ['gopay.svg'],
  midtrans_shopeepay: ['shopeepay.svg'],
  midtrans_credit_card: ['visa.svg', 'mastercard.svg'],
  midtrans_cstore: ['alfamart.svg', 'indomaret.svg'],
  bank_transfer: ['bank-transfer.svg'],
  cod: ['cod.svg'],
}

function paymentLogoSrc(file) {
  return `${import.meta.env.BASE_URL}payment-logos/${file}`
}

function PaymentLogo({ id, selected }) {
  const base = selected
    ? 'border-emerald-300 bg-white shadow-sm dark:border-emerald-700 dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
  const logos = PAYMENT_LOGOS[id] || []

  if (logos.length > 0) {
    return (
      <span
        className={`flex h-14 w-24 shrink-0 items-center justify-center gap-1 rounded-xl border px-2 ${base}`}
        aria-hidden="true"
      >
        {logos.map((file) => (
          <img key={file} src={paymentLogoSrc(file)} alt="" className="max-h-10 min-w-0 flex-1 object-contain" />
        ))}
      </span>
    )
  }

  return (
    <span className={`flex h-14 w-24 shrink-0 items-center justify-center rounded-xl border px-2 text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 ${base}`} aria-hidden="true">
      {id === 'bank_transfer' ? 'BANK' : 'COD'}
    </span>
  )
}

function paymentTitle(opt) {
  if (opt.id === 'cod') return 'COD - bayar di tempat'
  return opt.title
}

export default function Checkout() {
  const lines = getCart()
  const { user } = useAuth()
  const [paymentMethod, setPaymentMethod] = useState('midtrans_va_bca')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [offlineInfo, setOfflineInfo] = useState(null)

  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [shipPhone, setShipPhone] = useState('')
  const [shipAddr, setShipAddr] = useState('')
  const [provinceId, setProvinceId] = useState('')
  const [cityId, setCityId] = useState('')
  const [provName, setProvName] = useState('')
  const [cityName, setCityName] = useState('')
  const [postal, setPostal] = useState('')
  const [courier, setCourier] = useState('jne')
  const [quotes, setQuotes] = useState([])
  const [weightGram, setWeightGram] = useState(0)
  const [pick, setPick] = useState(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shipCfg, setShipCfg] = useState(null)
  const [districts, setDistricts] = useState([])
  const [subdistricts, setSubdistricts] = useState([])
  const [districtId, setDistrictId] = useState('')
  const [subdistrictId, setSubdistrictId] = useState('')
  const [districtName, setDistrictName] = useState('')
  const [subdistrictName, setSubdistrictName] = useState('')

  const shippingReady = shipCfg !== null
  const binderActive = shippingReady && shipCfg.api_configured
  const roOk = binderActive && provinces.length > 0
  const subtotal = lines.reduce((sum, l) => sum + Number(l.price || 0) * Number(l.qty || 0), 0)
  const shippingTotal = pick ? Number(pick.price || 0) : 0
  const grandTotal = subtotal + shippingTotal
  const cartKey = JSON.stringify(lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id || 0, qty: l.qty })))

  useEffect(() => {
    if (!user) return
    setShipPhone(user.phone || '')
    setShipAddr(user.address || '')
    setProvinceId(user.province_id || '')
    setCityId(user.city_id || '')
    setProvName(user.province_name || '')
    setCityName(user.city_name || '')
    setPostal(user.postal_code || '')
    setDistrictId(user.district_id || '')
    setDistrictName(user.district_name || '')
    setSubdistrictId(user.subdistrict_id || '')
    setSubdistrictName(user.subdistrict_name || '')
  }, [user])

  useEffect(() => {
    ;(async () => {
      try {
        const cfg = await api('/api/shipping/config')
        setShipCfg(cfg)
        try {
          const list = await api('/api/shipping/provinces')
          setProvinces(Array.isArray(list) ? list : [])
        } catch {
          setProvinces([])
        }
      } catch {
        setShipCfg({ provider: 'binderbyte', api_configured: false })
        try {
          const list = await api('/api/shipping/provinces')
          setProvinces(Array.isArray(list) ? list : [])
        } catch {
          setProvinces([])
        }
      }
    })()
  }, [])

  useEffect(() => {
    if (!provinceId) {
      setCities([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await api('/api/shipping/cities?province_id=' + encodeURIComponent(provinceId))
        if (!cancelled) setCities(Array.isArray(list) ? list : [])
      } catch {
        if (!cancelled) setCities([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [provinceId])

  useEffect(() => {
    if (!cityId || !binderActive) {
      setDistricts([])
      return
    }
    let cancelled = false
    api('/api/shipping/districts?city_id=' + encodeURIComponent(cityId))
      .then((list) => {
        if (!cancelled) setDistricts(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setDistricts([])
      })
    return () => {
      cancelled = true
    }
  }, [cityId, binderActive])

  useEffect(() => {
    if (!districtId || !binderActive) {
      setSubdistricts([])
      return
    }
    let cancelled = false
    api('/api/shipping/subdistricts?district_id=' + encodeURIComponent(districtId))
      .then((list) => {
        if (!cancelled) setSubdistricts(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setSubdistricts([])
      })
    return () => {
      cancelled = true
    }
  }, [districtId, binderActive])

  useEffect(() => {
    setQuotes([])
    setPick(null)
    setWeightGram(0)
    setShippingLoading(false)
    if (!roOk) return
    const slug = binderLocationSlug({ subdistrictName, districtName, cityName })
    if (!slug || !provinceId || !cityId || !districtId || !courier || !lines.length) return
    const items = lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id || 0, qty: l.qty }))
    let cancelled = false
    setErr('')
    setShippingLoading(true)
    ;(async () => {
      try {
        const data = await api('/api/shipping/estimate', {
          method: 'POST',
          body: JSON.stringify({
            items,
            destination_slug: slug,
            courier,
          }),
        })
        if (cancelled) return
        const nextQuotes = Array.isArray(data.quotes) ? data.quotes : []
        setQuotes(nextQuotes)
        setWeightGram(data.weight_gram || 0)
        if (nextQuotes.length === 0) {
          setErr('Tidak ada layanan untuk kurir ini. Coba kurir lain.')
        }
      } catch (e) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setShippingLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roOk, cityName, districtName, subdistrictName, provinceId, cityId, districtId, courier, cartKey])

  function selectQuote(q) {
    setPick(q)
  }

  function onProvChange(e) {
    const pid = e.target.value
    const name = provinces.find((p) => String(p.province_id) === String(pid))?.province || ''
    setProvinceId(pid)
    setProvName(name)
    setCityId('')
    setCityName('')
    setDistrictId('')
    setDistrictName('')
    setSubdistrictId('')
    setSubdistrictName('')
    setDistricts([])
    setSubdistricts([])
    setPick(null)
    setQuotes([])
  }

  function onCityChange(e) {
    const cid = e.target.value
    const row = cities.find((c) => String(c.city_id) === String(cid))
    setCityId(cid)
    setCityName(row ? `${row.type || ''} ${row.city_name || ''}`.trim() : '')
    setDistrictId('')
    setDistrictName('')
    setSubdistrictId('')
    setSubdistrictName('')
    setSubdistricts([])
    setPick(null)
    setQuotes([])
  }

  function onDistrictChange(e) {
    const id = e.target.value
    const row = districts.find((d) => String(d.district_id) === String(id))
    setDistrictId(id)
    setDistrictName(row?.district_name || '')
    setSubdistrictId('')
    setSubdistrictName('')
    setPick(null)
    setQuotes([])
    const z = row?.zip_code != null ? String(row.zip_code).trim() : ''
    if (z && z !== '0') setPostal(z)
  }

  function onSubdistrictChange(e) {
    const id = e.target.value
    const row = subdistricts.find((s) => String(s.subdistrict_id) === String(id))
    setSubdistrictId(id)
    setSubdistrictName(row?.subdistrict_name || '')
    setPick(null)
    setQuotes([])
    if (row?.zip_code) setPostal(String(row.zip_code))
  }

  async function pay() {
    setErr('')
    if (!lines.length) return
    if (!shipPhone.trim() || !shipAddr.trim()) {
      setErr('Isi nomor HP dan alamat pengiriman.')
      return
    }
    const slug = binderLocationSlug({ subdistrictName, districtName, cityName })
    if (roOk) {
      if (!provinceId.trim() || !cityId.trim() || !districtId.trim()) {
        setErr('Lengkapi provinsi, kabupaten/kota, dan kecamatan.')
        return
      }
      if (!slug) {
        setErr('Kab/kota tidak valid untuk perhitungan ongkir — pilih ulang dari daftar.')
        return
      }
      if (!pick) {
        setErr('Pilih kurir dan jenis layanan pengiriman terlebih dahulu.')
        return
      }
    } else {
      if (!provName.trim() || !cityName.trim()) {
        setErr('Isi wilayah pengiriman atau aktifkan layanan kurir dan lengkapi alamat admin.')
        return
      }
    }

    setLoading(true)
    setOfflineInfo(null)
    try {
      const items = lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id || 0, qty: l.qty }))
      const shipCityLabel = [cityName, districtName, subdistrictName].filter(Boolean).join(' · ')
      const payload = {
        items,
        payment_method: paymentMethod,
        shipping_phone: shipPhone.trim(),
        shipping_address: shipAddr.trim(),
        shipping_city_id: cityId || user?.city_id || '',
        shipping_province: provName,
        shipping_city: shipCityLabel,
        shipping_postal_code: postal.trim(),
        courier: roOk ? courier : '',
        shipping_service: roOk && pick ? pick.service : '',
        destination_slug: roOk ? slug : binderCitySlug(cityName),
      }

      const data = await api('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      if (!data.payment_url) {
        setCart([])
        setOfflineInfo({
          instructions: data.payment_instructions || '',
          order: data.order,
          method: data.payment_method,
        })
        setDone(true)
        setLoading(false)
        return
      }

      setCart([])
      window.location.href = data.payment_url
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  if (!lines.length && !done) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in text-center">
        <div className="card-elevated py-12">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Checkout</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Keranjang masih kosong.</p>
          <Link to="/" className="btn-primary mt-8 inline-flex">
            Belanja dulu
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in text-center">
        <div className="card-elevated relative overflow-hidden py-12 sm:py-14">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-transparent dark:from-emerald-950/40" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/50">
              ✓
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Pesanan dibuat</h1>
            {offlineInfo ? (
              <>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Metode: <strong className="text-slate-800 dark:text-slate-200">{offlineInfo.method}</strong>
                </p>
                {offlineInfo.order?.id != null && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Nomor order: #{offlineInfo.order.id}</p>
                )}
                <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 whitespace-pre-line dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  {offlineInfo.instructions}
                </div>
              </>
            ) : (
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Transaksi selesai atau menunggu konfirmasi. Status order diperbarui otomatis.
              </p>
            )}
            {offlineInfo?.order?.id != null && (
              <Link to={'/orders/' + offlineInfo.order.id + '/print'} className="btn-secondary mt-6 inline-flex">
                Cetak bukti pesanan
              </Link>
            )}
            <Link to="/" className={`btn-primary mt-6 inline-flex ${offlineInfo?.order?.id != null ? 'ml-2' : ''}`}>
              Kembali ke katalog
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Checkout</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
        Lengkapi alamat pengiriman, pilih layanan kurir, lalu lanjutkan pembayaran.
      </p>

      <div className="card-elevated mt-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Alamat pengiriman</h2>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nomor HP</label>
          <input className="input-field" value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="08…" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Alamat lengkap</label>
          <textarea
            className="input-field min-h-[88px] resize-y"
            value={shipAddr}
            onChange={(e) => setShipAddr(e.target.value)}
            placeholder="Jalan, RT/RW…"
          />
        </div>
        {!shippingReady && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat pengaturan pengiriman…</p>
        )}
        {shippingReady && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p>
                Pilih wilayah pengiriman dari provinsi sampai kelurahan agar layanan kurir bisa dihitung.
              </p>
              {!shipCfg.api_configured && (
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Layanan kurir belum aktif. Atur API ongkir di backend lalu restart.
                </p>
              )}
              {shipCfg.api_configured && provinces.length === 0 && (
                <p className="font-medium text-red-700 dark:text-red-300">Gagal memuat provinsi. Periksa API key atau log server.</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Provinsi</label>
              <select className="input-field" value={provinceId} onChange={onProvChange}>
                <option value="">Pilih</option>
                {provinces.map((p) => (
                  <option key={p.province_id} value={p.province_id}>
                    {p.province}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kabupaten / Kota</label>
              <select className="input-field" value={cityId} onChange={onCityChange} disabled={!provinceId}>
                <option value="">{provinceId ? 'Pilih kab/kota' : '—'}</option>
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
              <select className="input-field" value={districtId} onChange={onDistrictChange} disabled={!cityId}>
                <option value="">{cityId ? 'Pilih kecamatan' : '—'}</option>
                {districts.map((d) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.district_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Kelurahan / Desa {subdistricts.length === 0 && districtId ? '(opsional)' : ''}
              </label>
              <select
                className="input-field"
                value={subdistrictId}
                onChange={onSubdistrictChange}
                disabled={!districtId || subdistricts.length === 0}
              >
                <option value="">
                  {!districtId ? '—' : subdistricts.length === 0 ? 'Tidak ada daftar kelurahan' : 'Pilih kelurahan'}
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
          <input className="input-field" value={postal} onChange={(e) => setPostal(e.target.value)} />
        </div>

        {roOk ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kurir</label>
                <select className="input-field" value={courier} onChange={(e) => setCourier(e.target.value)}>
                  {COURIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {weightGram > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Berat kirim estimasi: {weightGram} g (dari berat produk × qty)</p>
            )}
            {shippingLoading && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat layanan pengiriman…</p>
            )}
            {!shippingLoading && courier && provinceId && cityId && districtId && quotes.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Layanan akan muncul otomatis setelah kecamatan/kelurahan dan kurir lengkap.</p>
            )}
            {quotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih layanan</p>
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {quotes.map((q, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => selectQuote(q)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                          pick && pick.service === q.service && pick.courier === q.courier
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60'
                        }`}
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {q.courier_name} · {q.service}
                        </span>
                        <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                          {money(q.price)}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{q.description} · ETD {q.etd}</span>
                        {q.note && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{q.note}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Layanan kurir belum aktif. Atur API ongkir dan alamat admin di backend.
          </p>
        )}
      </div>

      <fieldset className="mt-8 space-y-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Metode pembayaran</legend>
        <div className="grid gap-3 sm:grid-cols-1">
          {PAYMENT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                paymentMethod === opt.id
                  ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:ring-emerald-400/25'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="pay"
                value={opt.id}
                checked={paymentMethod === opt.id}
                onChange={() => setPaymentMethod(opt.id)}
                className="sr-only"
              />
              <PaymentLogo id={opt.id} selected={paymentMethod === opt.id} />
              <div className="min-w-0">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{paymentTitle(opt)}</span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="card-elevated mt-8">
        <div className="mb-5 space-y-2 text-sm">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal produk</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Ongkir{pick ? ` (${pick.courier_name} ${pick.service})` : ''}</span>
            <span>{pick ? money(shippingTotal) : 'Pilih layanan'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <span>Total bayar</span>
            <span>{money(grandTotal)}</span>
          </div>
        </div>
        {err && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        )}
        <button
          type="button"
          disabled={loading || shippingLoading || (roOk && !pick)}
          onClick={pay}
          className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Memproses…
            </span>
          ) : paymentMethod === 'cod' || paymentMethod === 'bank_transfer' ? (
            'Buat pesanan'
          ) : (
            'Lanjut bayar'
          )}
        </button>
      </div>
    </div>
  )
}

