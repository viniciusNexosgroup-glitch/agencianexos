'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'

type Contact = { id: string; name: string; phone: string; instance_name: string }
type Lead = {
  id: string
  title: string
  notes: string
  stage_id: string
  position: number
  contact_id: string
  value?: number
  whatsapp_contacts?: Contact
}
type Stage = { id: string; name: string; position: number; funnel_id: string }

const COLUMN_COLORS = [
  { bar: 'bg-purple-500', glow: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300' },
  { bar: 'bg-blue-500',   glow: 'border-blue-500/30',   badge: 'bg-blue-500/20 text-blue-300' },
  { bar: 'bg-green-500',  glow: 'border-green-500/30',  badge: 'bg-green-500/20 text-green-300' },
  { bar: 'bg-amber-500',  glow: 'border-amber-500/30',  badge: 'bg-amber-500/20 text-amber-300' },
  { bar: 'bg-pink-500',   glow: 'border-pink-500/30',   badge: 'bg-pink-500/20 text-pink-300' },
  { bar: 'bg-cyan-500',   glow: 'border-cyan-500/30',   badge: 'bg-cyan-500/20 text-cyan-300' },
  { bar: 'bg-rose-500',   glow: 'border-rose-500/30',   badge: 'bg-rose-500/20 text-rose-300' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_BG = ['bg-teal-600','bg-indigo-600','bg-purple-600','bg-pink-600','bg-orange-600','bg-cyan-600','bg-emerald-600']
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length]
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function LeadCard({ lead, onChat, onEdit, isDragging }: {
  lead: Lead
  onChat: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  const contact = lead.whatsapp_contacts

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-[#1a2232] border border-[#263044] rounded-xl p-3 cursor-grab active:cursor-grabbing select-none hover:border-[#374b6e] transition group ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2 flex-1">{lead.title}</p>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onEdit(lead)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition flex-shrink-0 mt-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {contact && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onChat(lead)}
          className="flex items-center gap-2 w-full hover:bg-[#263044] rounded-lg p-1.5 -mx-1.5 transition"
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${avatarBg(contact.name)}`}>
            {getInitials(contact.name)}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-slate-300 text-xs font-medium truncate">{contact.name}</p>
            <p className="text-slate-500 text-[10px] truncate">{contact.phone}</p>
          </div>
          <svg className="w-3 h-3 text-slate-600 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
      )}

      {(lead.value ?? 0) > 0 && (
        <div className="mt-2 flex items-center justify-end">
          <span className="text-green-400 text-xs font-semibold">{fmt(lead.value!)}</span>
        </div>
      )}

      {lead.notes && (
        <p className="mt-2 text-slate-500 text-xs line-clamp-1 italic">{lead.notes}</p>
      )}
    </div>
  )
}

function Column({ stage, leads, colorIdx, onChat, onEdit, onAddLead, activeId }: {
  stage: Stage
  leads: Lead[]
  colorIdx: number
  onChat: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onAddLead: (stageId: string) => void
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const color = COLUMN_COLORS[colorIdx % COLUMN_COLORS.length]
  const total = leads.reduce((s, l) => s + (l.value ?? 0), 0)

  return (
    <div className="flex-shrink-0 w-[260px] flex flex-col">
      {/* Column header */}
      <div className="mb-3">
        <div className={`h-1 rounded-full ${color.bar} mb-3`} />
        <div className="flex items-center justify-between">
          <h3 className="text-slate-200 text-xs font-semibold uppercase tracking-wider">{stage.name}</h3>
          <button
            onClick={() => onAddLead(stage.id)}
            className="text-slate-600 hover:text-slate-300 transition w-5 h-5 flex items-center justify-center rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <p className="text-slate-500 text-xs mt-0.5">
          {leads.length} lead{leads.length !== 1 ? 's' : ''}{total > 0 ? ` · ${fmt(total)}` : ' · R$0'}
        </p>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-xl flex flex-col gap-2 p-2 transition ${
          isOver ? `bg-[#1a2232] border border-dashed ${color.glow}` : 'bg-[#111827]/40'
        }`}
      >
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onChat={onChat}
            onEdit={onEdit}
            isDragging={lead.id === activeId}
          />
        ))}
        <button
          onClick={() => onAddLead(stage.id)}
          className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-[#1a2232] transition w-full"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar lead
        </button>
      </div>
    </div>
  )
}

function NewLeadModal({ stageId, stages, contacts, onClose, onCreated }: {
  stageId: string
  stages: Stage[]
  contacts: Contact[]
  onClose: () => void
  onCreated: (lead: Lead) => void
}) {
  const [title, setTitle] = useState('')
  const [selectedStageId, setSelectedStageId] = useState(stageId)
  const [contactId, setContactId] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const stage = stages.find(s => s.id === selectedStageId)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [onClose])

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch('/api/whatsapp/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        stageId: selectedStageId,
        funnelId: stage?.funnel_id,
        contactId: contactId || null,
        value: Number(value) || 0,
        notes,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.lead) onCreated(data.lead)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div ref={ref} className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Novo Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Nome do lead *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: João Silva - Proposta"
              autoFocus
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
              onKeyDown={e => { if (e.key === 'Enter') save() }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Etapa</label>
              <select
                value={selectedStageId}
                onChange={e => setSelectedStageId(e.target.value)}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition"
              >
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Valor (R$)</label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0"
                type="number"
                min="0"
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Contato</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition"
            >
              <option value="">Sem contato vinculado</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas sobre o lead..."
              rows={2}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            {saving ? 'Salvando...' : 'Criar Lead'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function EditLeadModal({ lead, onClose, onSaved, onDeleted }: {
  lead: Lead
  onClose: () => void
  onSaved: (lead: Lead) => void
  onDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState(lead.title)
  const [value, setValue] = useState(String(lead.value ?? 0))
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [markingWon, setMarkingWon] = useState(false)
  const [wonSuccess, setWonSuccess] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [onClose])

  async function save() {
    setSaving(true)
    await fetch('/api/whatsapp/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, title, value: Number(value) || 0, notes }),
    })
    setSaving(false)
    onSaved({ ...lead, title, value: Number(value) || 0, notes })
    onClose()
  }

  async function deleteLead() {
    if (!confirm('Excluir este lead?')) return
    await fetch(`/api/whatsapp/leads?id=${lead.id}`, { method: 'DELETE' })
    onDeleted(lead.id)
    onClose()
  }

  async function markAsWon() {
    if (markingWon || !lead.contact_id) return
    setMarkingWon(true)
    await fetch('/api/whatsapp/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: lead.contact_id,
        lead_id: lead.id,
        event_name: 'Purchase',
        value: Number(value) || lead.value || 0,
        currency: 'BRL',
      }),
    })
    setMarkingWon(false)
    setWonSuccess(true)
    setTimeout(() => setWonSuccess(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div ref={ref} className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Editar Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Nome do lead</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Valor (R$)</label>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              type="number"
              min="0"
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-col">
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={deleteLead} className="px-4 py-2.5 text-sm text-red-400 hover:text-red-300 border border-red-900 rounded-lg transition">
              Excluir
            </button>
          </div>
          {lead.contact_id && (
            <button
              onClick={markAsWon}
              disabled={markingWon}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                wonSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-green-900/30 hover:bg-green-900/60 text-green-400 border border-green-800'
              }`}
            >
              {wonSuccess ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Venda registrada!
                </>
              ) : markingWon ? 'Registrando...' : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registrar como venda (Meta Conversions)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function KanbanBoard({ stages, leads: initialLeads, contacts, onChat, onLeadMoved }: {
  stages: Stage[]
  leads: Lead[]
  contacts: Contact[]
  onChat: (lead: Lead) => void
  onLeadMoved?: (leadId: string, newStageId: string) => Promise<void>
}) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { setLeads(initialLeads) }, [initialLeads])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeLead = leads.find(l => l.id === activeId) ?? null

  function handleDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const leadId = String(active.id)
    const newStageId = String(over.id)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
    await onLeadMoved?.(leadId, newStageId)
  }

  const leadsFor = useCallback((stageId: string) => {
    const q = search.toLowerCase()
    return leads
      .filter(l => l.stage_id === stageId && (!q || l.title.toLowerCase().includes(q) || l.whatsapp_contacts?.name.toLowerCase().includes(q)))
      .sort((a, b) => a.position - b.position)
  }, [leads, search])

  const totalLeads = leads.length
  const totalValue = leads.reduce((s, l) => s + (l.value ?? 0), 0)

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Nenhuma etapa criada. Crie um funil com etapas primeiro.
      </div>
    )
  }

  return (
    <>
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-1 text-xs text-slate-500">
        <span>{totalLeads} lead{totalLeads !== 1 ? 's' : ''}</span>
        {totalValue > 0 && <span>· {fmt(totalValue)} total</span>}
        {search && <span className="text-indigo-400">· filtrado por "{search}"</span>}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 min-h-[calc(100vh-280px)]">
          {stages.map((stage, i) => (
            <Column
              key={stage.id}
              stage={stage}
              leads={leadsFor(stage.id)}
              colorIdx={i}
              onChat={onChat}
              onEdit={setEditLead}
              onAddLead={id => setNewLeadStageId(id)}
              activeId={activeId}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeLead && (
            <div className="bg-[#1a2232] border border-indigo-500/50 rounded-xl p-3 w-[260px] shadow-2xl rotate-1">
              <p className="text-white text-sm font-medium">{activeLead.title}</p>
              {activeLead.whatsapp_contacts && (
                <p className="text-slate-400 text-xs mt-1">{activeLead.whatsapp_contacts.name}</p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {newLeadStageId && (
        <NewLeadModal
          stageId={newLeadStageId}
          stages={stages}
          contacts={contacts}
          onClose={() => setNewLeadStageId(null)}
          onCreated={lead => setLeads(prev => [...prev, lead])}
        />
      )}

      {editLead && (
        <EditLeadModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
          onDeleted={id => setLeads(prev => prev.filter(l => l.id !== id))}
        />
      )}
    </>
  )
}
