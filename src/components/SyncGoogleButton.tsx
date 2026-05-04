'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  from: string
  to: string
  customerId: string
}

export function SyncGoogleButton({ from, to, customerId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function sync() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/sync-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, customerId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      } else {
        setResult(`${data.synced ?? 0} registros sincronizados`)
        router.refresh()
        setTimeout(() => setResult(null), 5000)
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400 max-w-[200px] truncate" title={error}>{error}</span>}
      {result && <span className="text-xs text-emerald-400">{result}</span>}
      <button
        onClick={sync}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white border border-indigo-600 rounded-lg transition font-medium"
        title="Sincronizar dados do Google Ads"
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
        {loading ? 'Sincronizando...' : 'Sincronizar Google Ads'}
      </button>
    </div>
  )
}
