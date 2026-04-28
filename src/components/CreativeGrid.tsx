'use client'

import { useState } from 'react'

interface Creative {
  ad_id: string
  ad_name: string
  campaign_name: string
  adset_name: string
  thumbnail_url: string | null
  effective_status: string | null
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number | null
  cpm: number | null
  purchases: number
  purchase_value: number
  leads: number
  roas: number
}

interface Props {
  creatives: Creative[]
  from: string
  to: string
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  if (status === 'ACTIVE')
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Ativo</span>
  if (status === 'PAUSED')
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pausado</span>
  return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">{status}</span>
}

function CreativeCard({ c }: { c: Creative }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      <div className="relative bg-slate-900" style={{ aspectRatio: '16/9' }}>
        {c.thumbnail_url && !imgError ? (
          <img
            src={c.thumbnail_url}
            alt={c.ad_name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={c.effective_status} />
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-white text-sm font-medium leading-snug line-clamp-2">{c.ad_name}</p>
          <p className="text-slate-500 text-xs mt-0.5 truncate" title={c.campaign_name}>{c.campaign_name}</p>
          {c.adset_name && (
            <p className="text-slate-600 text-[10px] truncate" title={c.adset_name}>{c.adset_name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-auto">
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">Gasto</p>
            <p className="text-indigo-400 text-sm font-bold">R$ {fmt(c.spend)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">Impressões</p>
            <p className="text-white text-sm font-medium">{fmtInt(c.impressions)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">CTR</p>
            <p className="text-white text-sm font-medium">{c.ctr.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">CPC</p>
            <p className="text-white text-sm font-medium">{c.cpc ? `R$ ${fmt(c.cpc)}` : '—'}</p>
          </div>
          {c.purchases > 0 && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wide">Compras</p>
              <p className="text-green-400 text-sm font-medium">{fmtInt(c.purchases)}</p>
            </div>
          )}
          {c.roas > 0 && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wide">ROAS</p>
              <p className={`text-sm font-bold ${c.roas >= 3 ? 'text-green-400' : c.roas >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                {c.roas.toFixed(2)}x
              </p>
            </div>
          )}
          {c.leads > 0 && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wide">Leads</p>
              <p className="text-green-400 text-sm font-medium">{fmtInt(c.leads)}</p>
            </div>
          )}
          {c.cpm !== null && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wide">CPM</p>
              <p className="text-slate-300 text-sm font-medium">R$ {fmt(c.cpm)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SyncButton({ from, to, variant }: { from: string; to: string; variant: 'inline' | 'large' }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function handleSync() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/sync-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erro ao sincronizar'); return }
      setDone(true)
      // Reload page to show fresh data
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setErr('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'large') {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">Nenhum criativo sincronizado</p>
          <p className="text-slate-500 text-sm mt-1">Clique para importar os anúncios do período da Meta Ads</p>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          onClick={handleSync}
          disabled={loading || done}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-lg transition"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Sincronizando...
            </>
          ) : done ? (
            <>✓ Concluído! Recarregando...</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Sincronizar Criativos
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading || done}
      title="Sincronizar criativos com a Meta Ads"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-lg transition disabled:opacity-50"
    >
      <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      {done ? 'Concluído!' : loading ? 'Sincronizando...' : 'Atualizar'}
    </button>
  )
}

export function CreativeGrid({ creatives, from, to }: Props) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  const filtered = filter === 'active'
    ? creatives.filter(c => c.effective_status === 'ACTIVE')
    : creatives

  if (!creatives.length) {
    return <SyncButton from={from} to={to} variant="large" />
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-slate-400 text-sm">{filtered.length} criativo{filtered.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center gap-3">
          <SyncButton from={from} to={to} variant="inline" />
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 transition ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 transition border-l border-slate-700 ${filter === 'active' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Ativos
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">Nenhum criativo ativo no período</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => <CreativeCard key={c.ad_id} c={c} />)}
        </div>
      )}
    </div>
  )
}
