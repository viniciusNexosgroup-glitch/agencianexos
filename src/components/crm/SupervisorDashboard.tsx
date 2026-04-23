'use client'

import { useState, useEffect, useCallback } from 'react'

interface DayMetrics {
  total_contacts_today: number
  messages_sent_today: number
  avg_response_time_min: number
  avg_csat: number
}

interface AgentReport {
  agent_id: string
  agent_name: string
  total_messages: number
  total_contacts: number
  avg_response_time_minutes: number | null
}

interface UnansweredContact {
  contact_id: string
  contact_name: string
  last_message: string
  waiting_since: string
  instance_name: string
}

type SortKey = 'total_messages' | 'total_contacts' | 'avg_response_time_minutes'
type SortDir = 'asc' | 'desc'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function waitingLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function SupervisorDashboard() {
  const [metrics, setMetrics] = useState<DayMetrics | null>(null)
  const [agents, setAgents] = useState<AgentReport[]>([])
  const [unanswered, setUnanswered] = useState<UnansweredContact[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('total_messages')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [metricsRes, agentsRes, unansweredRes] = await Promise.all([
        fetch('/api/whatsapp/reports/metrics?period=today'),
        fetch('/api/whatsapp/reports/agents?days=7'),
        fetch('/api/whatsapp/reports/unanswered?threshold_min=60'),
      ])

      if (metricsRes.ok) {
        const d = await metricsRes.json()
        setMetrics(d.metrics ?? d)
      }
      if (agentsRes.ok) {
        const d = await agentsRes.json()
        setAgents(d.agents ?? d ?? [])
      }
      if (unansweredRes.ok) {
        const d = await unansweredRes.json()
        setUnanswered(d.contacts ?? d ?? [])
      }
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedAgents = [...agents].sort((a, b) => {
    const av = (a[sortKey] ?? 0) as number
    const bv = (b[sortKey] ?? 0) as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-green-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Supervisor</h2>
          <p className="text-slate-400 text-sm mt-0.5">Visão em tempo real da operação</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-slate-500 text-xs">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Carregando dados...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Contatos com mensagem hoje"
              value={metrics?.total_contacts_today ?? 0}
            />
            <StatCard
              label="Mensagens enviadas hoje"
              value={metrics?.messages_sent_today ?? 0}
            />
            <StatCard
              label="Tempo médio de resposta"
              value={
                metrics?.avg_response_time_min != null
                  ? `${Math.round(metrics.avg_response_time_min)}min`
                  : '—'
              }
            />
            <StatCard
              label="CSAT médio"
              value={
                metrics?.avg_csat != null
                  ? `${metrics.avg_csat.toFixed(1)} / 5`
                  : '—'
              }
            />
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Desempenho dos agentes (últimos 7 dias)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Nome</th>
                    {(
                      [
                        ['total_messages', 'Msgs enviadas'],
                        ['total_contacts', 'Contatos atendidos'],
                        ['avg_response_time_minutes', 'Tempo médio resposta'],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        className="text-right px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        <SortIcon col={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        Nenhum dado de agente disponível
                      </td>
                    </tr>
                  ) : (
                    sortedAgents.map(a => (
                      <tr key={a.agent_id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                        <td className="px-4 py-3 text-white font-medium">{a.agent_name}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{(a.total_messages ?? 0).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{(a.total_contacts ?? 0).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {a.avg_response_time_minutes != null ? `${Math.round(a.avg_response_time_minutes)}min` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Fila sem resposta</h3>
              {unanswered.length > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unanswered.length}
                </span>
              )}
            </div>
            {unanswered.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum contato aguardando resposta há mais de 1h
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {unanswered.map(c => (
                  <div key={c.contact_id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-700/20 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm">{c.contact_name}</span>
                        <span className="text-slate-500 text-xs border border-slate-600 rounded px-1.5">
                          {c.instance_name}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">{c.last_message}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-red-400 text-sm font-medium">{waitingLabel(c.waiting_since)}</span>
                      <p className="text-slate-500 text-xs">sem resposta</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
