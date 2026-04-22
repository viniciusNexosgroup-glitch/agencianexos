'use client'

import { useState } from 'react'
import { KanbanBoard } from './KanbanBoard'
import { ChatPanel } from './ChatPanel'

type Stage = { id: string; name: string; position: number; funnel_id: string }
type Contact = { id: string; name: string; phone: string; instance_name: string }
type Lead = {
  id: string
  title: string
  notes: string
  stage_id: string
  position: number
  contact_id: string
  whatsapp_contacts?: Contact
}
type Funnel = { id: string; name: string; crm_stages: Stage[] }

export function FunnelManager({ funnels: initialFunnels }: { funnels: Funnel[] }) {
  const [funnels, setFunnels] = useState(initialFunnels)
  const [activeFunnelId, setActiveFunnelId] = useState(initialFunnels[0]?.id ?? null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState<Record<string, boolean>>({})
  const [chatLead, setChatLead] = useState<Lead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFunnelName, setNewFunnelName] = useState('')
  const [newStages, setNewStages] = useState('Novo Lead,Em contato,Proposta,Fechado')
  const [creating, setCreating] = useState(false)

  async function loadLeads(funnelId: string) {
    if (leadsLoaded[funnelId]) return
    const res = await fetch(`/api/whatsapp/leads?funnel_id=${funnelId}`)
    const data = await res.json()
    setLeads(prev => [...prev.filter(l => l.stage_id !== funnelId), ...(data.leads ?? [])])
    setLeadsLoaded(prev => ({ ...prev, [funnelId]: true }))
  }

  function switchFunnel(id: string) {
    setActiveFunnelId(id)
    loadLeads(id)
  }

  async function createFunnel() {
    if (!newFunnelName.trim()) return
    setCreating(true)
    const stages = newStages.split(',').map(s => s.trim()).filter(Boolean)
    const res = await fetch('/api/whatsapp/funnels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFunnelName, stages }),
    })
    const data = await res.json()
    setCreating(false)
    setShowCreate(false)
    setNewFunnelName('')
    // Reload funnels
    const res2 = await fetch('/api/whatsapp/funnels')
    const data2 = await res2.json()
    setFunnels(data2.funnels ?? [])
    if (data.funnel?.id) switchFunnel(data.funnel.id)
  }

  async function moveLeadToStage(leadId: string, newStageId: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
    await fetch('/api/whatsapp/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, stageId: newStageId }),
    })
  }

  const activeFunnel = funnels.find(f => f.id === activeFunnelId)
  const activeLeads = activeFunnelId ? leads.filter(l =>
    activeFunnel?.crm_stages.some(s => s.id === l.stage_id)
  ) : []

  const chatContact = chatLead?.whatsapp_contacts
    ? { ...chatLead.whatsapp_contacts }
    : null

  return (
    <div>
      {/* Funnel tabs + create */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {funnels.map(f => (
          <button
            key={f.id}
            onClick={() => switchFunnel(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeFunnelId === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f.name}
          </button>
        ))}
        <button
          onClick={() => setShowCreate(v => !v)}
          className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 transition"
        >
          + Novo funil
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
          <input
            value={newFunnelName}
            onChange={e => setNewFunnelName(e.target.value)}
            placeholder="Nome do funil (ex: Vendas)"
            className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
          />
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Etapas (separadas por vírgula)</label>
            <input
              value={newStages}
              onChange={e => setNewStages(e.target.value)}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createFunnel}
              disabled={creating || !newFunnelName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              {creating ? 'Criando...' : 'Criar funil'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-700 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {funnels.length === 0 && !showCreate && (
        <div className="text-slate-500 text-sm text-center py-16 border border-dashed border-slate-700 rounded-xl">
          Nenhum funil criado. Crie seu primeiro funil de vendas.
        </div>
      )}

      {activeFunnel && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <KanbanBoard
              stages={activeFunnel.crm_stages.sort((a, b) => a.position - b.position)}
              leads={activeLeads}
              onChat={setChatLead}
              onLeadMoved={moveLeadToStage}
            />
          </div>
          {chatContact && chatLead && (
            <div className="w-96 flex-shrink-0 h-[600px]">
              <ChatPanel contact={chatContact} onClose={() => setChatLead(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
