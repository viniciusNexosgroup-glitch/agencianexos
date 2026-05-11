'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  compact?: boolean
}

export function DiscoverAccountsButton({ compact }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ found: number; accounts: { id: string; name: string; active: boolean }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)

  async function handleDiscover() {
    setLoading(true)
    setError(null)
    setResult(null)
    setShowList(false)
    try {
      const res = await fetch('/api/discover-meta-accounts', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
      setShowList(true)
      router.refresh()
    } catch {
      setError('Erro ao conectar com a API.')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleDiscover}
          disabled={loading}
          title="Vincular todas as contas Meta"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
        >
          {loading ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
          {loading ? 'Vinculando...' : 'Vincular contas'}
        </button>

        {showList && result && (
          <div className="absolute right-0 top-10 z-50 w-80 bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-semibold">
                {result.found} conta{result.found !== 1 ? 's' : ''} vinculada{result.found !== 1 ? 's' : ''}
              </p>
              <button onClick={() => setShowList(false)} className="text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {result.accounts.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm py-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className="text-slate-200 truncate">{a.name}</span>
                  {!a.active && <span className="text-slate-500 text-xs flex-shrink-0">inativa</span>}
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-3">Selecione a conta no menu acima.</p>
          </div>
        )}

        {error && (
          <div className="absolute right-0 top-10 z-50 w-72 bg-red-900/80 border border-red-500/30 rounded-xl p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleDiscover}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
        >
          {loading ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {loading ? 'Buscando contas...' : 'Descobrir contas Meta'}
        </button>
        <p className="text-slate-500 text-xs">Busca todas as contas vinculadas ao token Meta</p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {result && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-white text-sm font-medium mb-3">
            {result.found} conta{result.found !== 1 ? 's' : ''} encontrada{result.found !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {result.accounts.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="text-white">{a.name}</span>
                <span className="text-slate-500 text-xs">{a.id}</span>
                {!a.active && <span className="text-slate-500 text-xs">(inativa)</span>}
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-xs mt-3">Seletor de conta atualizado.</p>
        </div>
      )}
    </div>
  )
}
