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

  if (balance === undefined || balance === null) return null

  const daysLeft = avgDailySpend > 0 ? Math.round(balance / avgDailySpend) : null
  const isLow = balance < 30
  const isCritical = balance < 10

  const accent = isCritical
    ? 'border-red-500/40 bg-red-500/5 text-red-400'
    : isLow
    ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'

  const daysText = daysLeft === null
    ? null
    : daysLeft < 1
    ? 'menos de 1 dia'
    : `~${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${accent}`}>
      <span className="text-base flex-shrink-0">💳</span>
      <span className="font-semibold">
        Saldo Meta: {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
      {daysText && (
        <>
          <span className="opacity-30">•</span>
          <span className="opacity-80">{daysText} restante{daysLeft !== 1 ? 's' : ''}</span>
        </>
      )}
      {isLow && <span className="ml-auto font-semibold flex-shrink-0">⚠️ Saldo baixo</span>}
    </div>
  )
}
