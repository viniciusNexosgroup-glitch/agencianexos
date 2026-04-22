'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
}

type Lead = {
  id: string
  title: string
  notes: string
  stage_id: string
  position: number
  contact_id: string
  whatsapp_contacts?: Contact
}

type Stage = {
  id: string
  name: string
  position: number
  funnel_id: string
}

function LeadCard({ lead, onChat, isDragging }: { lead: Lead; onChat: (lead: Lead) => void; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <p className="text-white text-sm font-medium truncate">{lead.title}</p>
      {lead.whatsapp_contacts && (
        <p className="text-slate-400 text-xs mt-1 truncate">{lead.whatsapp_contacts.name} · {lead.whatsapp_contacts.phone}</p>
      )}
      {lead.notes && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{lead.notes}</p>}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onChat(lead)}
        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition"
      >
        Abrir chat →
      </button>
    </div>
  )
}

function Column({ stage, leads, onChat, activeId }: {
  stage: Stage
  leads: Lead[]
  onChat: (lead: Lead) => void
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex-shrink-0 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-300 text-sm font-semibold">{stage.name}</h3>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] rounded-xl p-2 flex flex-col gap-2 transition ${isOver ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-slate-900/50'}`}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onChat={onChat} isDragging={lead.id === activeId} />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ stages, leads: initialLeads, onChat, onLeadMoved }: {
  stages: Stage[]
  leads: Lead[]
  onChat: (lead: Lead) => void
  onLeadMoved?: (leadId: string, newStageId: string) => Promise<void>
}) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const activeLead = leads.find(l => l.id === activeId) ?? null

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return

    const leadId = String(active.id)
    const newStageId = String(over.id)

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
    await onLeadMoved?.(leadId, newStageId)
  }

  const leadsFor = useCallback((stageId: string) =>
    leads.filter(l => l.stage_id === stageId).sort((a, b) => a.position - b.position),
    [leads]
  )

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Nenhuma etapa criada. Crie um funil com etapas primeiro.
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <Column
            key={stage.id}
            stage={stage}
            leads={leadsFor(stage.id)}
            onChat={onChat}
            activeId={activeId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <div className="bg-slate-800 border border-indigo-500 rounded-lg p-3 w-64 shadow-2xl opacity-90">
            <p className="text-white text-sm font-medium">{activeLead.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
