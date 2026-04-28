'use client'

import { useState } from 'react'

interface KeywordRow {
  term: string
  type: 'keyword' | 'search_term'
  match_type?: string
  campaign_name: string
  ad_group_name: string
  spend: number
  impressions: number
  conversions: number
  clicks: number
  ctr: number
}

interface Props {
  keywords: KeywordRow[]
  searchTerms: KeywordRow[]
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }

const MATCH_LABEL: Record<string, string> = {
  EXACT: 'Exata',
  BROAD: 'Ampla',
  PHRASE: 'Frase',
  '2': 'Exata',
  '3': 'Frase',
  '4': 'Ampla',
}

type SortKey = 'spend' | 'impressions' | 'conversions' | 'clicks' | 'ctr' | 'custo_resultado'

function Table({ rows }: { rows: KeywordRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const withDerived = rows.map(r => ({
    ...r,
    custo_resultado: r.conversions > 0 ? r.spend / r.conversions : null,
  }))

  const sorted = [...withDerived].sort((a, b) => {
    const av = sortKey === 'custo_resultado' ? (a.custo_resultado ?? Infinity) : a[sortKey]
    const bv = sortKey === 'custo_resultado' ? (b.custo_resultado ?? Infinity) : b[sortKey]
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (!rows.length) return (
    <div className="text-slate-500 text-sm text-center py-8">Nenhum dado encontrado. Execute o sync do Google Ads.</div>
  )

  const cols: { key: SortKey; label: string }[] = [
    { key: 'spend',           label: 'Valor usado' },
    { key: 'impressions',     label: 'Impressões' },
    { key: 'conversions',     label: 'Resultado' },
    { key: 'custo_resultado', label: 'Custo/Resultado' },
    { key: 'clicks',          label: 'Cliques' },
    { key: 'ctr',             label: 'CTR' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-slate-400 font-medium whitespace-nowrap">Palavra-chave / Termo</th>
            {cols.map(c => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="text-left px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white transition whitespace-nowrap select-none"
              >
                {c.label}
                {sortKey === c.key && <span className="ml-1 text-indigo-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-slate-800/40 transition">
              <td className="px-3 py-3 max-w-[280px]">
                <p className="text-white font-medium truncate">{row.term}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {row.match_type && (
                    <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-1">
                      {MATCH_LABEL[row.match_type] || row.match_type}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600 truncate">{row.campaign_name}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-indigo-300 font-medium whitespace-nowrap">R$ {fmt(row.spend)}</td>
              <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{fmtInt(row.impressions)}</td>
              <td className={`px-3 py-3 whitespace-nowrap font-medium ${row.conversions > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {row.conversions > 0 ? fmt(row.conversions) : '—'}
              </td>
              <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                {row.custo_resultado ? `R$ ${fmt(row.custo_resultado)}` : '—'}
              </td>
              <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{fmtInt(row.clicks)}</td>
              <td className={`px-3 py-3 whitespace-nowrap ${row.ctr * 100 >= 5 ? 'text-emerald-400' : row.ctr * 100 >= 2 ? 'text-amber-400' : 'text-red-400'}`}>
                {(row.ctr * 100).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GoogleKeywordTable({ keywords, searchTerms }: Props) {
  const [tab, setTab] = useState<'keywords' | 'search_terms'>('keywords')

  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-slate-800">
        <button
          onClick={() => setTab('keywords')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${tab === 'keywords' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          Palavras-chave ({keywords.length})
        </button>
        <button
          onClick={() => setTab('search_terms')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${tab === 'search_terms' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          Termos de pesquisa ({searchTerms.length})
        </button>
      </div>
      <Table rows={tab === 'keywords' ? keywords : searchTerms} />
    </div>
  )
}
