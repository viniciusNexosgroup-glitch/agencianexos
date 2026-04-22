'use client'

import { useState, useEffect } from 'react'
import { KanbanBoard } from './KanbanBoard'
import { ChatPanel } from './ChatPanel'

type Stage = { id: string; name: string; position: number; funnel_id: string }
type Contact = { id: string; name: string; phone: string; instance_name: string }
type Lead = {
  id: string; title: string; notes: string; stage_id: string; position: number
  contact_id: string; value?: number; whatsapp_contacts?: Contact
}
type Funnel = { id: string; name: string; crm_stages: Stage[] }

export function FunnelManager({ funnels: initialFunnels }: { funnels: Funnel[] }) {
  const [funnels, setFunnels] = useState(initialFunnels)
  const [activeFunnelId, setActiveFunnelId] = useState(initialFunnels[0]?.id ?? null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState<Record<string, boolean>>({})
  const [chatLead, setChatLead] = useState<Lead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFunnelName, setNewFunnelName] = useState('')
  const [newStages, setNewStages] = useState('Novo Lead,Em contato,Proposta,Fechado')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    fetch('/api/whatsapp/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.contacts ?? []))
  }, [])

  useEffect(() => {
    if (activeFunnelId && !leadsLoaded[activeFunnelId]) loadLeads(activeFunnelId)
  }, [activeFunnelId])

  async function loadLeads(funnelId: string) {
    const res = await fetch(`/api/whatsapp/leads?funnel_id=${funnelId}`)
    const data = await res.json()
    setLeads(prev => [
      ...prev.filter(l => !activeFunnel?.crm_stages.some(s => s.id === l.stage_id)),
      ...(data.leads ?? [])
    ])
    setLeadsLoaded(prev => ({ ...prev, [funnelId]: true }))
  }

  function switchFunnel(id: string) {
    setActiveFunnelId(id)
    setDropdownOpen(false)
  }

  async function createFunnel() {
    if (!newFunnelName.trim()) return
    setCreating(true)
    const stages = newStages.split(',').map(s => s.trim()).filter(Boolean)
    await fetch('/api/whatsapp/funnels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFunnelName, stages }),
    })
    setCreating(false)
    setShowCreate(false)
    setNewFunnelName('')
    const res2 = await fetch('/api/whatsapp/funnels')
    const data2 = await res2.json()
    setFunnels(data2.funnels ?? [])
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
  const activeLeads = leads.filter(l => activeFunnel?.crm_stages.some(s => s.id === l.stage_id))
  const chatContact = chatLead?.whatsapp_contacts ? { ...chatLead.whatsapp_contacts } : null

  const filteredLeads = search
    ? activeLeads.filter(l =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.whatsapp_contacts?.name.toLowerCase().includes(search.toLowerCase())
      )
    : activeLeads

  return (
    <div className="flex flex-col h-full">
      {/* Top bar — Kommo style */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Funnel selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 bg-[#111827] border border-slate-700 hover:border-slate-500 rounded-lg px-4 py-2 text-white text-sm font-semibold transition"
          >
            {activeFunnel?.name ?? 'Selecionar funil'}
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl z-20 min-w-[180px] py-1">
              {funnels.map(f => (
                <button
                  key={f.id}
                  onClick={() => switchFunnel(f.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-slate-800 ${activeFunnelId === f.id ? 'text-indigo-400 font-medium' : 'text-slate-300'}`}
                >
                  {f.name}
                </button>
              ))}
              <div className="border-t border-slate-700 mt-1 pt-1">
                <button
                  onClick={() => { setDropdownOpen(false); setShowCreate(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                >
                  + Novo funil
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center bg-[#111827] border border-slate-700 rounded-lg px-3 gap-2 flex-1 max-w-xs">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar leads..."
            className="bg-transparent text-white text-sm py-2 outline-none placeholder-slate-500 flex-1"
          />
        </div>

        {/* Novo Lead button */}
        {activeFunnel && (
          <button
            onClick={() => {
              const firstStage = activeFunnel.crm_stages.sort((a,b) => a.position - b.position)[0]
              if (firstStage) {
                // trigger new lead modal via KanbanBoard — we'll use a state here
                setShowCreate(false)
                // Just click the first column's add button by dispatching a custom event
                document.dispatchEvent(new CustomEvent('kanban:newlead', { detail: firstStage.id }))
              }
            }}
            className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Lead
          </button>
        )}
      </div>

      {/* Create funnel form */}
      {showCreate && (
        <div className="mb-5 bg-[#111827] border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-white font-medium text-sm">Criar novo funil</p>
          <input
            value={newFunnelName}
            onChange={e => setNewFunnelName(e.target.value)}
            placeholder="Nome do funil (ex: Vendas)"
            autoFocus
            className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
          />
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Etapas (separadas por vírgula)</label>
            <input
              value={newStages}
              onChange={e => setNewStages(e.target.value)}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition"
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
            <button onClick={() => setShowCreate(false)} className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-700 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {funnels.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium mb-1">Nenhum funil criado</p>
          <p className="text-slate-600 text-sm mb-4">Crie seu primeiro funil de vendas para organizar seus leads</p>
          <button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition">
            Criar funil
          </button>
        </div>
      )}

      {activeFunnel && (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <KanbanBoard
              stages={activeFunnel.crm_stages.sort((a, b) => a.position - b.position)}
              leads={filteredLeads}
              contacts={contacts}
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
