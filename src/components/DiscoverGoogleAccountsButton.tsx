'use client'

import { useState } from 'react'

export function DiscoverGoogleAccountsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ total: number; names: string[] } | null>(null)
  const [error, setError] = useState('')

  async function discover() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/google/discover-accounts', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        setError(msg || 'Erro ao descobrir contas')
      } else {
        setResult({ total: data.total, names: (data.accounts || []).map((a: any) => a.name) })
        setTimeout(() => setResult(null), 6000)
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      {result && (
        <span className="text-xs text-emerald-400">
          {result.total} conta(s) encontrada(s)
        </span>
      )}
      <button
        onClick={discover}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 rounded-lg transition font-medium"
        title="Descobrir todas as contas Google Ads acessíveis"
      >
        {loading ? (
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        {loading ? 'Buscando...' : 'Descobrir contas'}
      </button>
    </div>
  )
}
