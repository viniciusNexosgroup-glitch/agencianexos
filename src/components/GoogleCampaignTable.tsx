'use client'

import { useState } from 'react'

type Row = {
  campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversion_value: number
  ctr: number
  cpc: number | null
  cpm: number | null
  roas: number
}

type SortKey = keyof Row

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }

export function GoogleCampaignTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function sort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => sort(k)}
      className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  if (rows.length === 0) return <p className="text-slate-400 text-sm">Nenhuma campanha encontrada.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Campanha</th>
            <Th k="spend" label="Gasto" />
            <Th k="impressions" label="Impressões" />
            <Th k="clicks" label="Cliques" />
            <Th k="ctr" label="CTR" />
            <Th k="cpc" label="CPC" />
            <Th k="cpm" label="CPM" />
            <Th k="conversions" label="Conversões" />
            <Th k="roas" label="ROAS" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sorted.map(row => {
            const ctrColor = row.ctr >= 5 ? 'text-green-400' : row.ctr >= 2 ? 'text-yellow-400' : 'text-red-400'
            return (
              <tr key={row.campaign_id} className="hover:bg-slate-800/30 transition">
                <td className="px-3 py-3 text-white max-w-[200px] truncate" title={row.campaign_name}>
                  {row.campaign_name}
                </td>
                <td className="px-3 py-3 text-slate-300">R$ {fmt(row.spend)}</td>
                <td className="px-3 py-3 text-slate-300">{fmtInt(row.impressions)}</td>
                <td className="px-3 py-3 text-slate-300">{fmtInt(row.clicks)}</td>
                <td className={`px-3 py-3 font-medium ${ctrColor}`}>{(row.ctr * 100).toFixed(2)}%</td>
                <td className="px-3 py-3 text-slate-300">{row.cpc ? `R$ ${fmt(row.cpc)}` : '—'}</td>
                <td className="px-3 py-3 text-slate-300">{row.cpm ? `R$ ${fmt(row.cpm)}` : '—'}</td>
                <td className="px-3 py-3 text-slate-300">{fmt(row.conversions)}</td>
                <td className={`px-3 py-3 font-medium ${row.roas >= 3 ? 'text-green-400' : row.roas > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                  {row.roas > 0 ? `${row.roas.toFixed(2)}x` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
