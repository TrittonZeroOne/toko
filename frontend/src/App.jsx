import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth.jsx'
import { api } from './api.js'
import ThemeToggle from './ThemeToggle.jsx'
import Home from './pages/Home.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import Admin from './pages/Admin.jsx'
import Profile from './pages/Profile.jsx'
import Orders from './pages/Orders.jsx'
import OrderPrint from './pages/OrderPrint.jsx'
import Chat from './pages/Chat.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

function MenuIcon({ open }) {
  return (
    <div className="relative flex h-5 w-6 flex-col justify-center gap-1.5 text-slate-800 dark:text-slate-200">
      <span
        className={`h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-200 ${
          open ? 'translate-y-2 rotate-45' : ''
        }`}
      />
      <span className={`h-0.5 w-full rounded-full bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
      <span
        className={`h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-200 ${
          open ? '-translate-y-2 -rotate-45' : ''
        }`}
      />
    </div>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}

function orderStatusLabel(status) {
  if (status === 'belum_dibayar') return 'Belum dibayar'
  if (status === 'dikemas') return 'Dikemas'
  if (status === 'dikirim') return 'Dikirim'
  if (status === 'dibatalkan') return 'Dibatalkan'
  return status || 'Status berubah'
}

function orderStatusPhrase(status) {
  if (status === 'dikemas') return 'sedang dikemas'
  if (status === 'dikirim') return 'sedang dikirim'
  if (status === 'dibatalkan') return 'dibatalkan'
  if (status === 'belum_dibayar') return 'menunggu pembayaran'
  return orderStatusLabel(status).toLowerCase()
}

function personName(u, fallback = 'Customer') {
  if (!u) return fallback
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return name || u.email || fallback
}

function orderProductSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) return 'produk'
  const first = items[0]
  const product = first.product?.name || `produk #${first.product_id}`
  const variant = first.variant_name ? ` ${first.variant_name}` : ''
  const extra = items.length > 1 ? ` dan ${items.length - 1} produk lainnya` : ''
  return `${product}${variant}${extra}`
}

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function NotificationBell({ onNavigate }) {
  const { user, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) {
      setItems([])
      setUnread(0)
      return
    }
    let cancelled = false
    const scope = isAdmin ? 'admin' : `customer_${user.id || user.email}`
    const statusKey = `toko_notif_statuses_${scope}`
    const seenKey = `toko_notif_seen_order_${scope}`

    async function loadNotifications() {
      try {
        const orders = await api(isAdmin ? '/api/admin/orders' : '/api/orders')
        if (cancelled || !Array.isArray(orders)) return
        const previousStatuses = readJSON(statusKey, {})
        const nextStatuses = {}
        orders.forEach((o) => {
          nextStatuses[o.id] = o.status
        })

        if (isAdmin) {
          const seen = Number(localStorage.getItem(seenKey) || 0)
          const fresh = orders
            .filter((o) => Number(o.id) > seen)
            .map((o) => ({
              id: o.id,
              title: `${personName(o.user)} memesan ${orderProductSummary(o)}`,
              message: `Order #${o.id} · ${formatIDR(o.total)}`,
              to: '/admin?tab=orders',
            }))
          setItems(fresh.slice(0, 6))
          setUnread(fresh.length)
        } else {
          const hasSnapshot = Object.keys(previousStatuses).length > 0
          const changed = hasSnapshot
            ? orders
                .filter((o) => previousStatuses[o.id] && previousStatuses[o.id] !== o.status)
                .map((o) => ({
                  id: o.id,
                  title: `Pesanan ${orderProductSummary(o)} ${orderStatusPhrase(o.status)}`,
                  message: orderStatusLabel(o.status),
                  to: '/orders',
                }))
            : []
          setItems(changed.slice(0, 6))
          setUnread(changed.length)
        }
        localStorage.setItem(statusKey, JSON.stringify(nextStatuses))
      } catch {
        if (!cancelled) {
          setItems([])
          setUnread(0)
        }
      }
    }

    loadNotifications()
    const timer = window.setInterval(loadNotifications, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user, isAdmin])

  if (!user) return null

  function markRead() {
    setOpen((v) => !v)
    if (isAdmin && items.length > 0) {
      const maxID = Math.max(...items.map((x) => Number(x.id) || 0))
      localStorage.setItem(`toko_notif_seen_order_admin`, String(maxID))
    }
    setUnread(0)
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-600/80 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-300"
        aria-label="Notifikasi"
        onClick={markRead}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-[70] w-72 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Notifikasi</div>
          {items.length === 0 ? (
            <p className="px-4 py-5 text-slate-500 dark:text-slate-400">Belum ada notifikasi baru.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.id}-${item.message}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <Link
                    to={item.to}
                    className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    onClick={() => {
                      setOpen(false)
                      onNavigate?.()
                    }}
                  >
                    <span className="block font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const loc = useLocation()

  const closeMobile = () => setMobileOpen(false)

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email
    : ''

  const navLinkClass = (path, tab = '') => {
    const active =
      path === '/admin' && tab
        ? loc.pathname === '/admin' && new URLSearchParams(loc.search).get('tab') === tab
        : path === '/'
        ? loc.pathname === '/' || loc.pathname.startsWith('/product')
        : path === '/orders'
          ? loc.pathname.startsWith('/orders')
          : loc.pathname === path
    return `rounded-lg px-3 py-2 text-sm font-medium transition md:px-2 md:py-1.5 ${
      active
        ? 'bg-emerald-50 text-emerald-800 md:bg-transparent md:text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 md:dark:bg-transparent md:dark:text-emerald-400'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 md:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 md:dark:hover:bg-transparent'
    }`
  }

  const chatSeenKey = user ? `toko_chat_seen_${isAdmin ? 'admin' : `customer_${user.id || user.email}`}` : ''

  useEffect(() => {
    if (!user) {
      setChatUnread(0)
      return
    }
    let cancelled = false
    async function loadChatUnread() {
      try {
        const data = await api(isAdmin ? '/api/admin/chats' : '/api/chat')
        if (cancelled || !Array.isArray(data)) return
        const seen = localStorage.getItem(chatSeenKey) || ''
        const role = isAdmin ? 'admin' : 'customer'
        const unread = data.filter((m) => m.sender_role !== role && String(m.created_at || '') > seen).length
        setChatUnread(unread)
      } catch {
        if (!cancelled) setChatUnread(0)
      }
    }
    loadChatUnread()
    const timer = window.setInterval(loadChatUnread, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user, isAdmin, chatSeenKey])

  useEffect(() => {
    if (!user || !loc.pathname.endsWith('/chat')) return
    localStorage.setItem(chatSeenKey, new Date().toISOString())
    setChatUnread(0)
  }, [user, loc.pathname, chatSeenKey])

  function ChatNavLink({ mobile = false }) {
    const to = isAdmin ? '/admin/chat' : '/chat'
    if (mobile) {
      return (
        <Link className={navLinkClass(to)} to={to} onClick={closeMobile}>
          Chat {chatUnread > 0 ? `(${chatUnread > 99 ? '99+' : chatUnread})` : ''}
        </Link>
      )
    }
    return (
      <Link
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-600/80 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-300 ${
          loc.pathname === to ? 'border-emerald-300 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300' : ''
        }`}
        to={to}
        title="Chat"
        aria-label="Chat"
      >
        <ChatIcon />
        {chatUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {chatUnread > 99 ? '99+' : chatUnread}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="app-gradient min-h-screen flex flex-col font-sans">
      <header className="glass-header sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-xl py-1 pr-2 transition hover:opacity-90 active:scale-[0.98]"
            onClick={closeMobile}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-lg font-bold text-white shadow-glow ring-2 ring-white/30 dark:ring-emerald-400/20 sm:h-10 sm:w-10">
              T
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              Toko<span className="text-emerald-600 dark:text-emerald-400">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex md:gap-0.5 lg:gap-1">
            {user ? (
              <>
                {isAdmin ? (
                  <>
                    <Link className={navLinkClass('/admin', 'products')} to="/admin?tab=products">
                      Produk
                    </Link>
                    <Link className={navLinkClass('/admin', 'categories')} to="/admin?tab=categories">
                      Kategori
                    </Link>
                    <Link className={navLinkClass('/admin', 'orders')} to="/admin?tab=orders">
                      Order
                    </Link>
                    <Link className={navLinkClass('/admin', 'sales')} to="/admin?tab=sales">
                      Laporan
                    </Link>
                    <ChatNavLink />
                  </>
                ) : (
                  <>
                    <Link className={navLinkClass('/')} to="/">
                      Produk
                    </Link>
                    <Link className={navLinkClass('/cart')} to="/cart">
                      Keranjang
                    </Link>
                    <Link className={navLinkClass('/orders')} to="/orders">
                      Pesanan
                    </Link>
                    <ChatNavLink />
                  </>
                )}
                <Link className={navLinkClass('/profile')} to="/profile">
                  Profil
                </Link>
                <span
                  className="mx-1 hidden max-w-[160px] truncate text-xs text-slate-500 dark:text-slate-400 lg:inline"
                  title={user.email}
                >
                  {displayName}
                </span>
                <NotificationBell />
                <ThemeToggle className="mx-0.5" />
                <button type="button" onClick={logout} className="btn-secondary !py-1.5 !text-xs">
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link className={navLinkClass('/')} to="/">
                  Produk
                </Link>
                <ThemeToggle className="mx-0.5" />
                <Link className={navLinkClass('/login')} to="/login">
                  Masuk
                </Link>
                <Link
                  to="/register"
                  className="ml-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 dark:shadow-emerald-900/40"
                >
                  Daftar
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1.5 md:hidden">
            <NotificationBell onNavigate={closeMobile} />
            <ThemeToggle />
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/90"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
              onClick={() => setMobileOpen((o) => !o)}
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60 md:hidden"
              aria-hidden
              onClick={closeMobile}
            />
            <div className="animate-fade-in fixed inset-y-0 right-0 z-50 flex w-[min(100%,18rem)] flex-col border-l border-slate-200/80 bg-white/98 shadow-2xl dark:border-slate-700/80 dark:bg-slate-950/98 md:hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Menu</span>
                <button type="button" className="btn-ghost !p-2 text-slate-500 dark:text-slate-400" onClick={closeMobile}>
                  ✕
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 p-3">
                {user ? (
                  <>
                    {isAdmin ? (
                      <>
                        <Link className={navLinkClass('/admin', 'products')} to="/admin?tab=products" onClick={closeMobile}>
                          Produk Admin
                        </Link>
                        <Link className={navLinkClass('/admin', 'categories')} to="/admin?tab=categories" onClick={closeMobile}>
                          Kategori
                        </Link>
                        <Link className={navLinkClass('/admin', 'orders')} to="/admin?tab=orders" onClick={closeMobile}>
                          Order
                        </Link>
                        <Link className={navLinkClass('/admin', 'sales')} to="/admin?tab=sales" onClick={closeMobile}>
                          Laporan
                        </Link>
                        <ChatNavLink mobile />
                      </>
                    ) : (
                      <>
                        <Link className={navLinkClass('/')} to="/" onClick={closeMobile}>
                          Produk
                        </Link>
                        <Link className={navLinkClass('/cart')} to="/cart" onClick={closeMobile}>
                          Keranjang
                        </Link>
                        <Link className={navLinkClass('/orders')} to="/orders" onClick={closeMobile}>
                          Pesanan
                        </Link>
                        <ChatNavLink mobile />
                      </>
                    )}
                    <Link className={navLinkClass('/profile')} to="/profile" onClick={closeMobile}>
                      Profil
                    </Link>
                    <p className="truncate px-3 py-1 text-sm font-medium text-slate-800 dark:text-slate-100">{displayName}</p>
                    <p className="truncate px-3 py-1 text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    <button
                      type="button"
                      className="btn-secondary mt-auto justify-start"
                      onClick={() => {
                        logout()
                        closeMobile()
                      }}
                    >
                      Keluar
                    </button>
                  </>
                ) : (
                  <>
                    <Link className={navLinkClass('/')} to="/" onClick={closeMobile}>
                      Produk
                    </Link>
                    <Link className={navLinkClass('/login')} to="/login" onClick={closeMobile}>
                      Masuk
                    </Link>
                    <Link to="/register" className="btn-primary mt-2 w-full" onClick={closeMobile}>
                      Daftar
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 sm:py-8 lg:px-6 lg:py-10">{children}</main>

      <footer className="mt-auto border-t border-slate-200/60 bg-white/50 py-6 text-center text-xs text-slate-500 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/50 dark:text-slate-400 sm:py-8">
        <p className="mx-auto max-w-md px-4">Single-vendor e-commerce · Fiber · React</p>
      </footer>
    </div>
  )
}

function Private({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function CustomerOnly({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin?tab=products" replace />
  return children
}

function AdminOnly({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/cart"
            element={
              <CustomerOnly>
                <Cart />
              </CustomerOnly>
            }
          />
          <Route
            path="/checkout"
            element={
              <CustomerOnly>
                <Checkout />
              </CustomerOnly>
            }
          />
          <Route
            path="/profile"
            element={
              <Private>
                <Profile />
              </Private>
            }
          />
          <Route
            path="/orders"
            element={
              <CustomerOnly>
                <Orders />
              </CustomerOnly>
            }
          />
          <Route
            path="/orders/:id/print"
            element={
              <CustomerOnly>
                <OrderPrint />
              </CustomerOnly>
            }
          />
          <Route
            path="/chat"
            element={
              <CustomerOnly>
                <Chat />
              </CustomerOnly>
            }
          />
          <Route
            path="/admin/orders/:id/print"
            element={
              <AdminOnly>
                <OrderPrint />
              </AdminOnly>
            }
          />
          <Route
            path="/admin/chat"
            element={
              <AdminOnly>
                <Chat />
              </AdminOnly>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <Admin />
              </AdminOnly>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
