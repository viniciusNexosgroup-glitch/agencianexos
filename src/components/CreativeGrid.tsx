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
      <img src={url} alt={name} className="w-full h-full object-cover rounded" onError={() => setErr(true)} />
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
      <div className="flex-shrink-0 w-16 h-9 rounded overflow-hidden">
        <Thumb url={c.thumbnail_url} name={c.ad_name} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge status={c.effective_status} />
        </div>
        <p className="text-white text-sm font-medium leading-tight truncate">{c.ad_name}</p>
        <p className="text-slate-500 text-xs truncate">{c.campaign_name}</p>
        {c.adset_name && <p className="text-slate-600 text-[10px] truncate">{c.adset_name}</p>}
      </div>

      <div className="hidden lg:grid gap-x-6 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(7, minmax(72px, 1fr))' }}>
        <MetricCol label="Valor usado" value={`R$ ${fmt(c.spend)}`} />
        <MetricCol label="Alcance" value={fmtInt(c.reach)} />
        <MetricCol label="Resultado" value={resultado > 0 ? fmtInt(resultado) : '—'} highlight={resultado > 0} />
        <MetricCol label="Custo/Result." value={custoResultado ? `R$ ${fmt(custoResultado)}` : '—'} />
        <MetricCol label="Cliques" value={fmtInt(c.clicks)} />
        <MetricCol label="CTR" value={`${c.ctr.toFixed(2)}%`} />
        <MetricCol label="Frequência" value={c.frequency > 0 ? c.frequency.toFixed(2) : '—'} />
      </div>

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

export function CreativeGrid({ creatives }: Props) {
  if (!creatives.length) {
    return (
      <div className="text-slate-500 text-sm text-center py-10">
        Nenhum criativo encontrado. Use o botão Atualizar para sincronizar.
      </div>
    )
  }

  return (
    <div>
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
      {creatives.map(c => <CreativeRow key={c.ad_id} c={c} />)}
    </div>
  )
}
