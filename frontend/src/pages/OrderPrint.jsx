import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function personName(u, fallback = '-') {
  if (!u) return fallback
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return n || u.email || fallback
}

function personAddressLines(u) {
  if (!u) return []
  return addressLines({
    address: u.address,
    city: [u.city_name, u.district_name, u.subdistrict_name].filter(Boolean).join(' · '),
    province: u.province_name,
    postalCode: u.postal_code,
  })
}

function shippingAddressLines(order) {
  return addressLines({
    address: order.shipping_address,
    city: order.shipping_city,
    province: order.shipping_province,
    postalCode: order.shipping_postal_code,
  })
}

function addressLines({ address, city, province, postalCode }) {
  const area = [city, province].filter(Boolean).join(', ')
  return [address, area, postalCode ? 'Kode pos ' + postalCode : ''].filter(Boolean)
}

function paymentLabel(method) {
  const m = String(method || '').toLowerCase()
  if (m === 'cod') return 'COD'
  if (m === 'bank_transfer') return 'Transfer bank manual'
  if (m === 'midtrans_va_bca') return 'Virtual Account BCA'
  if (m === 'midtrans_va_bni') return 'Virtual Account BNI'
  if (m === 'midtrans_va_bri') return 'Virtual Account BRI'
  if (m === 'midtrans_va_mandiri') return 'Mandiri Bill Payment'
  if (m === 'midtrans_va_permata') return 'Virtual Account Permata'
  if (m === 'midtrans_qris') return 'QRIS'
  if (m === 'midtrans_gopay') return 'GoPay'
  if (m === 'midtrans_shopeepay') return 'ShopeePay'
  if (m === 'midtrans_credit_card') return 'Kartu kredit'
  if (m === 'midtrans_cstore') return 'Convenience store'
  return method || '-'
}

export default function OrderPrint() {
  const { id } = useParams()
  const loc = useLocation()
  const admin = loc.pathname.startsWith('/admin')
  const { user: currentUser } = useAuth()
  const [order, setOrder] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const path = admin ? '/api/admin/orders/' + id : '/api/orders/' + id
    api(path)
      .then(setOrder)
      .catch((e) => setErr(e.message))
  }, [id, admin])

  function doPrint() {
    window.print()
  }

  if (err) {
    return (
      <div className="card-elevated py-12 text-center">
        <p className="text-red-700 dark:text-red-300">{err}</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Home
        </Link>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="py-12 text-center text-slate-600 dark:text-slate-400">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    )
  }

  const u = order.user
  const sender = order.sender || (admin && currentUser?.role === 'admin' ? currentUser : null)
  const title = admin ? 'Surat jalan / pesanan (admin)' : 'Bukti pemesanan'
  const senderAddress = personAddressLines(sender)
  const receiverAddress = shippingAddressLines(order)

  return (
    <div className="animate-fade-in">
      <div className="no-print mb-6 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={doPrint}>
          Cetak / PDF
        </button>
        <Link to={admin ? '/admin' : '/orders'} className="btn-secondary">
          {admin ? 'Kembali ke admin' : 'Ke daftar pesanan'}
        </Link>
      </div>

      <div className="card-elevated mx-auto max-w-3xl print:border-0 print:shadow-none print:bg-white">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-700 print:border-slate-300">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">{title}</p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white print:text-black">Toko.</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            Order #{order.id} - {new Date(order.created_at).toLocaleString('id-ID')}
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 print:text-slate-600">Pengirim</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 print:text-black">{personName(sender, 'Admin Toko')}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 print:text-slate-800">{sender?.phone || '-'}</p>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 print:text-slate-800">
              {senderAddress.length > 0 ? senderAddress.join('\n') : 'Alamat admin belum diisi di profil admin.'}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 print:text-slate-600">Penerima</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 print:text-black">{order.ship_to_name || personName(u)}</p>
            {order.shipping_phone && <p className="text-sm text-slate-700 dark:text-slate-300 print:text-slate-800">{order.shipping_phone}</p>}
            {u?.email && <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">{u.email}</p>}
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 print:text-slate-800">
              {receiverAddress.length > 0 ? receiverAddress.join('\n') : 'Alamat penerima belum tersedia.'}
            </div>
            {(order.courier || order.shipping_service) && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Kurir: {order.courier?.toUpperCase()} {order.shipping_service}
              </p>
            )}
            {order.tracking_number && (
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                Resi: {order.tracking_number}
              </p>
            )}
          </div>
        </div>

        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 print:border-slate-300">
              <th className="py-2 pr-2">Produk</th>
              <th className="py-2 pr-2 text-center">Qty</th>
              <th className="py-2 text-right">Harga</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it) => (
              <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800 print:border-slate-200">
                <td className="py-2 pr-2 text-slate-900 dark:text-slate-100 print:text-black">
                  {it.product?.name || '#' + it.product_id}
                  {it.variant_name ? ` - ${it.variant_name}` : ''}
                </td>
                <td className="py-2 pr-2 text-center">{it.qty}</td>
                <td className="py-2 text-right">{formatIDR(it.price)}</td>
                <td className="py-2 text-right font-medium">{formatIDR(it.price * it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 space-y-1 border-t border-slate-200 pt-4 text-sm dark:border-slate-700 print:border-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Subtotal barang</span>
            <span>{formatIDR(order.subtotal ?? order.total)}</span>
          </div>
          {(order.shipping_cost ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Ongkir</span>
              <span>{formatIDR(order.shipping_cost)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-emerald-700 dark:text-emerald-400 print:text-black">
            <span>Total</span>
            <span>{formatIDR(order.total)}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bayar: {paymentLabel(order.payment_method)} - Status: {order.status}
          </p>
        </div>
      </div>
    </div>
  )
}
