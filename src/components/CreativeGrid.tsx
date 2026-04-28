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
      {/* Thumbnail */}
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

      {/* Info + métricas */}
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

export function CreativeGrid({ creatives }: Props) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  const filtered = filter === 'active'
    ? creatives.filter(c => c.effective_status === 'ACTIVE')
    : creatives

  if (!creatives.length) return (
    <div className="text-slate-500 text-sm text-center py-10">
      Nenhum criativo com veiculação no período. Execute o sync para carregar os dados.
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-slate-400 text-sm">{filtered.length} criativo{filtered.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex rounded-lg overflow-hidden border border-slate-700 text-sm">
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
