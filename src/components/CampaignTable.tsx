'use client'

import { useState } from 'react'

interface CampaignRow {
  campaign_id: string
  campaign_name: string
  spend: number
  reach: number
  resultado: number
  custo_resultado: number | null
  clicks: number
  ctr: number
  frequency: number
}

type SortKey = keyof CampaignRow
type SortDir = 'asc' | 'desc'

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }

const columns: { key: SortKey; label: string; render: (r: CampaignRow) => string }[] = [
  { key: 'campaign_name',   label: 'Campanha',          render: r => r.campaign_name || r.campaign_id },
  { key: 'spend',           label: 'Valor usado',        render: r => `R$ ${fmt(r.spend)}` },
  { key: 'reach',           label: 'Alcance',            render: r => fmtInt(r.reach) },
  { key: 'resultado',       label: 'Resultado',          render: r => r.resultado > 0 ? fmtInt(r.resultado) : '—' },
  { key: 'custo_resultado', label: 'Custo/Resultado',    render: r => r.custo_resultado ? `R$ ${fmt(r.custo_resultado)}` : '—' },
  { key: 'clicks',          label: 'Cliques',            render: r => fmtInt(r.clicks) },
  { key: 'ctr',             label: 'CTR',                render: r => r.ctr.toFixed(2) + '%' },
  { key: 'frequency',       label: 'Frequência',         render: r => r.frequency.toFixed(2) },
]

function ctrColor(ctr: number) {
  if (ctr >= 2) return 'text-emerald-400'
  if (ctr >= 1) return 'text-amber-400'
  return 'text-red-400'
}

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (!rows.length) return (
    <div className="text-center py-8 text-slate-500 text-sm">Sem campanhas no período</div>
  )

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="text-left px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white transition whitespace-nowrap select-none"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-indigo-400">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map(row => (
            <tr key={row.campaign_id} className="hover:bg-slate-800/40 transition">
              {columns.map(col => {
                const val = col.render(row)
                let cls = 'px-3 py-3 text-slate-300 whitespace-nowrap'
                if (col.key === 'campaign_name') cls = 'px-3 py-3 text-white font-medium max-w-[260px] truncate'
                if (col.key === 'spend') cls = 'px-3 py-3 text-indigo-300 font-medium whitespace-nowrap'
                if (col.key === 'ctr') cls += ' ' + ctrColor(row.ctr)
                if (col.key === 'resultado' && row.resultado > 0) cls += ' text-emerald-400 font-medium'
                return (
                  <td
                    key={col.key}
                    className={cls}
                    title={col.key === 'campaign_name' ? row.campaign_name : undefined}
                  >
                    {val}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
