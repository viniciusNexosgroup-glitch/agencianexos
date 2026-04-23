'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: 'Kanban',
    href: '/dashboard/crm?tab=kanban',
    matchHref: '/dashboard/crm',
    matchTab: 'kanban',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
      </svg>
    ),
  },
  {
    label: 'Contatos',
    href: '/dashboard/crm?tab=contatos',
    matchHref: '/dashboard/crm',
    matchTab: 'contatos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: 'Instâncias',
    href: '/dashboard/crm?tab=instancias',
    matchHref: '/dashboard/crm',
    matchTab: 'instancias',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.1-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>
      </svg>
    ),
  },
  {
    label: 'Broadcast',
    href: '/dashboard/crm?tab=broadcast',
    matchHref: '/dashboard/crm',
    matchTab: 'broadcast',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M22 8.5c0 2.76-4.48 5-10 5S2 11.26 2 8.5 6.48 3.5 12 3.5s10 2.24 10 5z"/>
        <path d="M2 8.5c0 2.76 4.48 5 10 5s10-2.24 10-5"/>
        <path d="M2 12v3.5c0 2.76 4.48 5 10 5s10-2.24 10-5V12"/>
      </svg>
    ),
  },
  {
    label: 'Supervisor',
    href: '/dashboard/crm?tab=supervisor',
    matchHref: '/dashboard/crm',
    matchTab: 'supervisor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Flows',
    href: '/dashboard/crm?tab=flows',
    matchHref: '/dashboard/crm',
    matchTab: 'flows',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
  {
    label: 'Agente IA',
    href: '/dashboard/crm?tab=ia',
    matchHref: '/dashboard/crm',
    matchTab: 'ia',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    label: 'Admin',
    href: '/admin',
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

// ─── NotificationDropdown ─────────────────────────────────────────────────────

function NotificationDropdown({
  notifications,
  onMarkOne,
  onMarkAll,
  onClose,
}: {
  notifications: Notification[]
  onMarkOne: (id: string) => void
  onMarkAll: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const unread = notifications.filter(n => !n.read)

  return (
    <div
      ref={ref}
      className="absolute left-full ml-2 bottom-0 w-72 bg-[#1e2c35] border border-[#2a3942] rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ maxHeight: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3942]">
        <span className="text-white text-sm font-semibold">Notificações</span>
        {unread.length > 0 && (
          <button
            onClick={onMarkAll}
            className="text-[10px] text-[#00a884] hover:text-[#06cf9c] transition font-medium"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <svg className="w-8 h-8 text-[#3d4f5a] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-[#8696a0] text-xs">Nenhuma notificação</p>
          </div>
        )}
        {notifications.map(n => (
          <button
            key={n.id}
            onClick={() => !n.read && onMarkOne(n.id)}
            className={`w-full text-left px-4 py-3 border-b border-[#2a3942] last:border-0 transition hover:bg-[#2a3942] ${
              n.read ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-[#00a884] flex-shrink-0 mt-1.5" />
              )}
              {n.read && <span className="w-2 h-2 flex-shrink-0 mt-1.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-[#e9edef] text-xs font-medium truncate">{n.title}</p>
                <p className="text-[#8696a0] text-[11px] mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                <p className="text-[#4a5878] text-[10px] mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Notificações
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread_only=true')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? data ?? [])
    } catch {
      // silencia erros de rede
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  async function markOne(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
    } catch { /* silencia */ }
  }

  async function markAll() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      })
    } catch { /* silencia */ }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function isActive(item: typeof NAV[0]) {
    const i = item as any
    const matchPath = i.matchHref || item.href.split('?')[0]
    const onCorrectPath = pathname === matchPath || pathname.startsWith(matchPath + '/')

    if (item.exact && !i.matchHref) return pathname === item.href.split('?')[0]

    if (i.matchTab) {
      const currentTab = searchParams.get('tab') ?? 'kanban'
      return onCorrectPath && currentTab === i.matchTab
    }

    return onCorrectPath
  }

  const filtered = NAV.filter(i => !(i as any).adminOnly || isAdmin)

  return (
    <aside className="hidden lg:flex flex-col w-[72px] flex-shrink-0 bg-[#13192a] border-r border-[#1e2a40] min-h-screen sticky top-0 h-screen">
      {/* Logo */}
      <div className="flex flex-col items-center py-4 border-b border-[#1e2a40]">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center py-3 gap-1">
        {filtered.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 w-full px-1 py-2.5 rounded-xl transition-all relative group ${
                active
                  ? 'text-white'
                  : 'text-[#4a5878] hover:text-[#8899bb]'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-indigo-500 rounded-r-full" />
              )}
              <span className={`${active ? 'text-indigo-400' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[9px] font-medium tracking-wide leading-none">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User + Notificações + Logout */}
      <div className="flex flex-col items-center py-3 gap-2 border-t border-[#1e2a40]">

        {/* Sininho de notificações */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(p => !p)}
            title="Notificações"
            className="relative text-[#4a5878] hover:text-[#8899bb] transition p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <NotificationDropdown
              notifications={notifications}
              onMarkOne={markOne}
              onMarkAll={markAll}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>

        {/* Avatar do usuário */}
        <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
          {userName.slice(0, 2).toUpperCase()}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sair"
          className="text-[#4a5878] hover:text-[#8899bb] transition p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
