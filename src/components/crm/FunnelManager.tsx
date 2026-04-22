'use client'

import { useState, useEffect, useRef } from 'react'
import { KanbanBoard } from './KanbanBoard'
import { ChatPanel } from './ChatPanel'

type Stage = { id: string; name: string; position: number; funnel_id: string }
type Contact = { id: string; name: string; phone: string; instance_name: string }
type Lead = {
  id: string; title: string; notes: string; stage_id: string; position: number
  contact_id: string; value?: number; whatsapp_contacts?: Contact
}
type Funnel = { id: string; name: string; crm_stages: Stage[] }

const STAGE_COLORS = ['#4e8ef7','#f5c842','#f5a623','#9b59b6','#e74c3c','#1abc9c','#e67e22']

const TEMPLATES: Record<string, { stages: string[]; colors: string[] }> = {
  'Customizado': { stages: [], colors: [] },
  'Loja online': { stages: ['Contato inicial','Proposta enviada','Aguardando pagamento','Pedido confirmado'], colors: ['#4e8ef7','#f5c842','#f5a623','#1abc9c'] },
  'Consultoria': { stages: ['Qualificação','Diagnóstico','Proposta','Negociação'], colors: ['#4e8ef7','#9b59b6','#f5a623','#f5c842'] },
  'Serviços': { stages: ['Briefing','Proposta','Assinatura'], colors: ['#4e8ef7','#f5c842','#1abc9c'] },
  'Marketing': { stages: ['Lead capturado','Qualificado','Em proposta','Fechamento'], colors: ['#4e8ef7','#f5c842','#f5a623','#1abc9c'] },
  'Agência de viagem': { stages: ['Interesse','Cotação','Reserva confirmada'], colors: ['#4e8ef7','#f5a623','#1abc9c'] },
}

type DraftStage = { id: string; name: string; color: string }

function FunnelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (funnel: Funnel) => void }) {
  const [template, setTemplate] = useState('Customizado')
  const [funnelName, setFunnelName] = useState('')
  const [stages, setStages] = useState<DraftStage[]>([
    { id: '1', name: 'Contato inicial', color: '#4e8ef7' },
    { id: '2', name: 'Proposta', color: '#f5c842' },
    { id: '3', name: 'Negociação', color: '#f5a623' },
  ])
  const [saving, setSaving] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [onClose])

  function applyTemplate(name: string) {
    setTemplate(name)
    const t = TEMPLATES[name]
    if (t.stages.length > 0) {
      setStages(t.stages.map((s, i) => ({ id: String(i + 1), name: s, color: t.colors[i] || '#4e8ef7' })))
    } else {
      setStages([{ id: '1', name: '', color: '#4e8ef7' }])
    }
  }

  function addStage() {
    const color = STAGE_COLORS[stages.length % STAGE_COLORS.length]
    setStages(prev => [...prev, { id: String(Date.now()), name: '', color }])
  }

  function updateStage(id: string, name: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  function removeStage(id: string) {
    setStages(prev => prev.filter(s => s.id !== id))
  }

  function handleDragStart(i: number) { setDragIdx(i) }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setOverIdx(i) }
  function handleDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...stages]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    setStages(next)
    setDragIdx(null)
    setOverIdx(null)
  }

  async function save() {
    const name = funnelName.trim() || template
    if (!name) return
    const validStages = stages.filter(s => s.name.trim()).map(s => s.name.trim())
    if (validStages.length === 0) return
    setSaving(true)
    const res = await fetch('/api/whatsapp/funnels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stages: validStages }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.funnel) onCreated(data.funnel)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div ref={ref} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 font-semibold text-lg">Configurar funil de vendas</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm transition">Cancelar</button>
            <button
              onClick={save}
              disabled={saving || !stages.some(s => s.name.trim())}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left — Templates */}
          <div className="w-44 flex-shrink-0 border-r border-gray-200 py-4 overflow-y-auto">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 mb-3">Modelos</p>
            {Object.keys(TEMPLATES).map(t => (
              <button
                key={t}
                onClick={() => applyTemplate(t)}
                className={`w-full text-left px-4 py-2 text-sm transition ${template === t ? 'text-indigo-600 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {template === t && <span className="mr-1">✓</span>}{t}
              </button>
            ))}
          </div>

          {/* Right — Stage editor */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Funnel name */}
            <div>
              <label className="text-gray-600 text-xs font-medium mb-1.5 block">Nome do funil</label>
              <input
                value={funnelName}
                onChange={e => setFunnelName(e.target.value)}
                placeholder={template}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Leads recebidos */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-900 text-sm font-medium">Leads recebidos</p>
                <div className="w-10 h-5 bg-indigo-500 rounded-full flex items-center justify-end pr-0.5">
                  <div className="w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>
              <p className="text-gray-500 text-xs">Esta etapa captura automaticamente os leads de todas as fontes e canais que você conectou</p>
              <div className="mt-3 bg-gray-200 rounded-lg px-3 py-2 text-gray-600 text-sm">Leads recebidos</div>
            </div>

            {/* Active stages */}
            <div>
              <p className="text-gray-700 text-sm font-semibold mb-1">Etapas ativas</p>
              <p className="text-gray-500 text-xs mb-3">Essas são as etapas principais do seu fluxo de trabalho</p>

              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={handleDrop}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition ${overIdx === i && dragIdx !== i ? 'ring-2 ring-indigo-400' : ''}`}
                    style={{ backgroundColor: stage.color + '33', borderLeft: `4px solid ${stage.color}` }}
                  >
                    <span className="text-gray-400 cursor-grab select-none text-lg leading-none">⠿</span>
                    <input
                      value={stage.name}
                      onChange={e => updateStage(stage.id, e.target.value)}
                      placeholder="Nome da etapa"
                      className="flex-1 bg-transparent text-gray-900 text-sm font-medium outline-none placeholder-gray-400"
                    />
                    {/* Color picker */}
                    <div className="flex items-center gap-1">
                      {STAGE_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, color: c } : s))}
                          className={`w-4 h-4 rounded-full transition ${stage.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button onClick={() => removeStage(stage.id)} className="text-gray-400 hover:text-red-500 transition ml-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addStage}
                className="mt-3 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition w-full border border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-3 py-2.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar etapa
              </button>
            </div>

            {/* End stages */}
            <div>
              <p className="text-gray-700 text-sm font-semibold mb-1">Itinerário enviado</p>
              <p className="text-gray-500 text-xs mb-3">Essas etapas marcam o fim do seu fluxo de trabalho</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#4caf5033', borderLeft: '4px solid #4caf50' }}>
                  <span className="text-gray-400 text-lg leading-none">⠿</span>
                  <span className="text-gray-800 text-sm font-medium flex-1">Venda ganha</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#9e9e9e22', borderLeft: '4px solid #9e9e9e' }}>
                  <span className="text-gray-400 text-lg leading-none">⠿</span>
                  <span className="text-gray-800 text-sm font-medium flex-1">Venda perdida</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FunnelManager({ funnels: initialFunnels }: { funnels: Funnel[] }) {
  const [funnels, setFunnels] = useState(initialFunnels)
  const [activeFunnelId, setActiveFunnelId] = useState(initialFunnels[0]?.id ?? null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState<Record<string, boolean>>({})
  const [chatLead, setChatLead] = useState<Lead | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    fetch('/api/whatsapp/contacts').then(r => r.json()).then(d => setContacts(d.contacts ?? []))
  }, [])

  const activeFunnel = funnels.find(f => f.id === activeFunnelId)

  useEffect(() => {
    if (activeFunnelId && !leadsLoaded[activeFunnelId]) loadLeads(activeFunnelId)
  }, [activeFunnelId])

  async function loadLeads(funnelId: string) {
    const res = await fetch(`/api/whatsapp/leads?funnel_id=${funnelId}`)
    const data = await res.json()
    setLeads(prev => [
      ...prev.filter(l => !funnels.find(f => f.id === funnelId)?.crm_stages.some(s => s.id === l.stage_id)),
      ...(data.leads ?? [])
    ])
    setLeadsLoaded(prev => ({ ...prev, [funnelId]: true }))
  }

  function switchFunnel(id: string) { setActiveFunnelId(id); setDropdownOpen(false) }

  async function moveLeadToStage(leadId: string, newStageId: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
    await fetch('/api/whatsapp/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, stageId: newStageId }),
    })
  }

  const activeLeads = leads.filter(l => activeFunnel?.crm_stages.some(s => s.id === l.stage_id))
  const filteredLeads = search
    ? activeLeads.filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.whatsapp_contacts?.name.toLowerCase().includes(search.toLowerCase()))
    : activeLeads
  const chatContact = chatLead?.whatsapp_contacts ? { ...chatLead.whatsapp_contacts } : null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
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
                <button key={f.id} onClick={() => switchFunnel(f.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-slate-800 ${activeFunnelId === f.id ? 'text-indigo-400 font-medium' : 'text-slate-300'}`}>
                  {f.name}
                </button>
              ))}
              <div className="border-t border-slate-700 mt-1 pt-1">
                <button onClick={() => { setDropdownOpen(false); setShowModal(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition">
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads..."
            className="bg-transparent text-white text-sm py-2 outline-none placeholder-slate-500 flex-1" />
        </div>

        {/* Novo Lead */}
        {activeFunnel && (
          <button
            onClick={() => {
              const firstStage = activeFunnel.crm_stages.sort((a, b) => a.position - b.position)[0]
              if (firstStage) document.dispatchEvent(new CustomEvent('kanban:newlead', { detail: firstStage.id }))
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

      {funnels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium mb-1">Nenhum funil criado</p>
          <p className="text-slate-600 text-sm mb-4">Crie seu primeiro funil de vendas para organizar seus leads</p>
          <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition">
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

      {showModal && (
        <FunnelModal
          onClose={() => setShowModal(false)}
          onCreated={async (funnel) => {
            const res = await fetch('/api/whatsapp/funnels')
            const data = await res.json()
            setFunnels(data.funnels ?? [])
            setActiveFunnelId(funnel.id)
          }}
        />
      )}
    </div>
  )
}
