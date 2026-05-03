'use client'

import { useState, useEffect } from 'react'

interface Props {
  accountId: string
  avgDailySpend: number
}

export function BalanceCard({ accountId, avgDailySpend }: Props) {
  const [balance, setBalance] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    setBalance(undefined)
    fetch(`/api/meta-balance?account=${accountId}`)
      .then(r => r.json())
      .then(d => setBalance(typeof d.balance === 'number' && d.balance > 0 ? d.balance : null))
      .catch(() => setBalance(null))
  }, [accountId])

  if (balance === undefined) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-500/10 p-4 animate-pulse">
        <div className="h-3 w-24 bg-slate-700 rounded mb-3" />
        <div className="h-7 w-32 bg-slate-700 rounded" />
      </div>
    )
  }

  if (balance === null) return null

  const daysLeft = avgDailySpend > 0 ? Math.floor(balance / avgDailySpend) : null
  const color = balance < 10 ? 'red' : balance < 30 ? 'yellow' : 'green'

  const styles = {
    red:    'text-red-400 bg-red-500/10 border-red-500/30',
    yellow: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    green:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  }[color]

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">Saldo Meta</span>
        <span className="text-base">💳</span>
      </div>
      <p className="text-2xl font-bold">
        {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      {daysLeft !== null && (
        <p className="text-xs mt-1 opacity-70">
          ~{daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
        </p>
      )}
      {balance < 30 && (
        <p className="text-xs mt-1 font-semibold">⚠️ Saldo baixo</p>
      )}
    </div>
  )
}
