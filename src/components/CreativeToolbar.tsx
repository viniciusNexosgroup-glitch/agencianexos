'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  from: string
  to: string
  activeFilter: 'all' | 'active'
}

export function CreativeToolbar({ from, to, activeFilter }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(false)

  function setFilter(f: 'all' | 'active') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('creative_filter', f)
    router.push(`?${params.toString()}`)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/sync-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      setDone(true)
      setTimeout(() => router.refresh(), 1000)
    } catch {
      // silent
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing || done}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition disabled:opacity-50"
      >
        <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        {done ? 'Concluído!' : syncing ? 'Atualizando...' : 'Atualizar'}
      </button>

      <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 transition ${activeFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 transition border-l border-slate-700 ${activeFilter === 'active' ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Ativos
        </button>
      </div>
    </div>
  )
}
