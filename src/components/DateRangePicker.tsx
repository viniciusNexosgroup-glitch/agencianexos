'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Account { ad_account_id: string; account_name: string | null; bm_name: string | null }

interface Props {
  defaultFrom: string
  defaultTo: string
  accounts: Account[]
  selectedAccount: string
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
]

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function prevMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last  = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    from: first.toISOString().split('T')[0],
    to:   last.toISOString().split('T')[0],
  }
}

function currMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    from: first.toISOString().split('T')[0],
    to:   now.toISOString().split('T')[0],
  }
}

export function DateRangePicker({ defaultFrom, defaultTo, accounts, selectedAccount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [account, setAccount] = useState(selectedAccount)
  const [syncing, setSyncing] = useState(false)

  function apply(f = from, t = to, acc = account) {
    startTransition(() => {
      router.push(`/dashboard?from=${f}&to=${t}&account=${acc}`)
    })
  }

  async function changeAccount(newAccount: string, f = from, t = to) {
    setAccount(newAccount)
    setSyncing(true)
    startTransition(() => {
      router.push(`/dashboard?from=${f}&to=${t}&account=${newAccount}`)
    })
    try {
      await fetch('/api/sync-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: f, to: t, accountId: newAccount }),
      })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  function applyPreset(days: number) {
    const f = daysAgo(days)
    const t = new Date().toISOString().split('T')[0]
    setFrom(f); setTo(t)
    apply(f, t)
  }

  const busy = isPending || syncing

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      {/* Seletor de conta */}
      {accounts.length >= 1 && (
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs whitespace-nowrap">Conta:</span>
          <div className="relative">
            <select
              value={account}
              disabled={busy}
              onChange={e => changeAccount(e.target.value)}
              className={`bg-[#1e293b] border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[220px] truncate transition-opacity ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {accounts.map(a => (
                <option key={a.ad_account_id} value={a.ad_account_id}>
                  {a.account_name || a.ad_account_id}
                </option>
              ))}
            </select>
            {busy && (
              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {syncing && (
            <span className="text-xs text-indigo-400 whitespace-nowrap">Sincronizando...</span>
          )}
        </div>
      )}

      {/* Presets */}
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => {
            const r = currMonthRange()
            setFrom(r.from); setTo(r.to)
            apply(r.from, r.to)
          }}
          className="px-2.5 py-1.5 text-xs bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-300 rounded-lg transition whitespace-nowrap"
        >
          Mês atual
        </button>
        <button
          onClick={() => {
            const r = prevMonthRange()
            setFrom(r.from); setTo(r.to)
            apply(r.from, r.to)
          }}
          className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition whitespace-nowrap"
        >
          Mês ant.
        </button>
      </div>

      {/* Datas customizadas */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-slate-500 text-sm">→</span>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => apply()}
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
        >
          {isPending ? '...' : 'Aplicar'}
        </button>
      </div>
    </div>
  )
}
