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
  reach: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  purchase_value: number
  leads: number
  conversations: number
  profile_visits: number
  frequency: number
}

interface Props {
  creatives: Creative[]
  from: string
  to: string
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'ACTIVE')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Ativo</span>
  if (status === 'PAUSED')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pausado</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">{status ?? '—'}</span>
}

function Thumb({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false)
  if (url && !err) {
    return (
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover rounded"
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center text-slate-700 rounded bg-slate-800">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    </div>
  )
}

function MetricCol({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-green-400' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

function CreativeRow({ c }: { c: Creative }) {
  const resultado = c.conversations > 0 ? c.conversations
    : c.leads > 0 ? c.leads
    : c.purchases > 0 ? c.purchases
    : c.profile_visits
  const custoResultado = resultado > 0 ? c.spend / resultado : null

  return (
    <div className="flex items-center gap-4 py-3 border-t border-slate-800 hover:bg-slate-900/40 transition-colors px-2 rounded-lg">
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-9 rounded overflow-hidden">
        <Thumb url={c.thumbnail_url} name={c.ad_name} />
      </div>

      {/* Nome + campanha */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge status={c.effective_status} />
        </div>
        <p className="text-white text-sm font-medium leading-tight truncate">{c.ad_name}</p>
        <p className="text-slate-500 text-xs truncate">{c.campaign_name}</p>
        {c.adset_name && <p className="text-slate-600 text-[10px] truncate">{c.adset_name}</p>}
      </div>

      {/* Métricas */}
      <div className="hidden lg:grid gap-x-6 gap-y-0 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(7, minmax(72px, 1fr))' }}>
        <MetricCol label="Valor usado" value={`R$ ${fmt(c.spend)}`} />
        <MetricCol label="Alcance" value={fmtInt(c.reach)} />
        <MetricCol label="Resultado" value={resultado > 0 ? fmtInt(resultado) : '—'} highlight={resultado > 0} />
        <MetricCol label="Custo/Result." value={custoResultado ? `R$ ${fmt(custoResultado)}` : '—'} />
        <MetricCol label="Cliques" value={fmtInt(c.clicks)} />
        <MetricCol label="CTR" value={`${c.ctr.toFixed(2)}%`} />
        <MetricCol label="Frequência" value={c.frequency > 0 ? c.frequency.toFixed(2) : '—'} />
      </div>

      {/* Mobile: métricas compactas */}
      <div className="lg:hidden flex gap-4 flex-shrink-0 text-right">
        <div>
          <p className="text-[10px] text-slate-500">Gasto</p>
          <p className="text-sm text-indigo-400 font-medium">R$ {fmt(c.spend)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">CTR</p>
          <p className="text-sm text-slate-200 font-medium">{c.ctr.toFixed(2)}%</p>
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
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/sync-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erro ao sincronizar'); return }
      setDone(true)
      setTimeout(() => window.location.reload(), 800)
    } catch { setErr('Erro de conexão') } finally { setLoading(false) }
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
          <p className="text-slate-500 text-sm mt-1">Importe os anúncios do período da Meta Ads</p>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button onClick={handleSync} disabled={loading || done}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-lg transition">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {done ? 'Concluído! Recarregando...' : loading ? 'Sincronizando...' : 'Sincronizar Criativos'}
        </button>
      </div>
    )
  }

  return (
    <button onClick={handleSync} disabled={loading || done}
      title="Atualizar criativos"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition disabled:opacity-50">
      <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      {done ? 'Concluído!' : loading ? 'Atualizando...' : 'Atualizar'}
    </button>
  )
}

export function CreativeGrid({ creatives, from, to }: Props) {
  const [filter, setFilter] = useState<'all' | 'active'>('active')

  const filtered = filter === 'active'
    ? creatives.filter(c => c.effective_status === 'ACTIVE')
    : creatives

  if (!creatives.length) {
    return <SyncButton from={from} to={to} variant="large" />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-slate-400 text-sm">{filtered.length} criativo{filtered.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center gap-3">
          <SyncButton from={from} to={to} variant="inline" />
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 transition ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              Todos
            </button>
            <button onClick={() => setFilter('active')}
              className={`px-3 py-1.5 transition border-l border-slate-700 ${filter === 'active' ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              Ativos
            </button>
          </div>
        </div>
      </div>

      {/* Colunas header — desktop */}
      {filtered.length > 0 && (
        <div className="hidden lg:flex items-center gap-4 px-2 mb-1">
          <div className="w-16 flex-shrink-0" />
          <div className="flex-1" />
          <div className="grid gap-x-6 flex-shrink-0 text-[10px] text-slate-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: 'repeat(7, minmax(72px, 1fr))' }}>
            <span>Valor usado</span>
            <span>Alcance</span>
            <span>Resultado</span>
            <span>Custo/Result.</span>
            <span>Cliques</span>
            <span>CTR</span>
            <span>Frequência</span>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">Nenhum criativo ativo no período</div>
      ) : (
        <div>
          {filtered.map(c => <CreativeRow key={c.ad_id} c={c} />)}
        </div>
      )}
    </div>
  )
}
