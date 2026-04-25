'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, isToday, parseISO, addDays,
  getHours, getMinutes, differenceInMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ─────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  start_at: string
  end_at: string
  all_day: boolean
  color: string
  contact_name?: string | null
  contact_phone?: string | null
  synced_to_google: boolean
  google_event_id?: string | null
}

type View = 'month' | 'week'

const EVENT_COLORS = [
  { label: 'Verde',    value: '#00a884' },
  { label: 'Azul',     value: '#4285f4' },
  { label: 'Vermelho', value: '#ea4335' },
  { label: 'Laranja',  value: '#f5a623' },
  { label: 'Roxo',     value: '#9b59b6' },
  { label: 'Rosa',     value: '#e91e63' },
]

const WEEK_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6h–21h
const PX_PER_MIN = 1.2

// ─── Helpers ───────────────────────────────────────────────────────────────

function toLocalDateTimeValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToISO(val: string) {
  return new Date(val).toISOString()
}

function eventTop(iso: string) {
  const d = parseISO(iso)
  return ((getHours(d) - 6) * 60 + getMinutes(d)) * PX_PER_MIN
}

function eventHeight(startIso: string, endIso: string) {
  const mins = differenceInMinutes(parseISO(endIso), parseISO(startIso))
  return Math.max(mins * PX_PER_MIN, 24)
}

function defaultEnd(start: string) {
  const d = new Date(start)
  d.setHours(d.getHours() + 1)
  return toLocalDateTimeValue(d.toISOString())
}

// ─── Modal de evento ──────────────────────────────────────────────────────

function EventModal({
  event,
  googleConnected,
  onClose,
  onSave,
  onDelete,
}: {
  event: Partial<CalEvent> & { id?: string }
  googleConnected: boolean
  onClose: () => void
  onSave: (data: Partial<CalEvent>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const isNew = !event.id
  const [title, setTitle]         = useState(event.title ?? '')
  const [description, setDesc]    = useState(event.description ?? '')
  const [location, setLocation]   = useState(event.location ?? '')
  const [startVal, setStartVal]   = useState(event.start_at ? toLocalDateTimeValue(event.start_at) : '')
  const [endVal, setEndVal]       = useState(event.end_at ? toLocalDateTimeValue(event.end_at) : '')
  const [allDay, setAllDay]       = useState(event.all_day ?? false)
  const [color, setColor]         = useState(event.color ?? '#00a884')
  const [contactName, setContact] = useState(event.contact_name ?? '')
  const [saving, setSaving]       = useState(false)
  const [confirming, setConfirm]  = useState(false)

  async function handleSave() {
    if (!title.trim() || !startVal || !endVal) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description || null,
      location: location || null,
      start_at: localInputToISO(startVal),
      end_at: localInputToISO(endVal),
      all_day: allDay,
      color,
      contact_name: contactName || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-gray-800 font-semibold text-base">
            {isNew ? 'Novo Evento' : 'Editar Evento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Título */}
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do evento"
            className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none text-gray-800 text-lg font-medium pb-1 transition"
          />

          {/* Google sync badge */}
          {googleConnected && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Será sincronizado com Google Agenda
            </div>
          )}

          {/* Dia inteiro */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-gray-600">Dia inteiro</span>
          </label>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 font-medium">Início</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startVal.slice(0, 10) : startVal}
                onChange={e => {
                  setStartVal(e.target.value)
                  setEndVal(defaultEnd(e.target.value))
                }}
                className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Fim</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? endVal.slice(0, 10) : endVal}
                onChange={e => setEndVal(e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 transition"
              />
            </div>
          </div>

          {/* Contato/Lead */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Lead / Cliente (opcional)</label>
            <input
              value={contactName}
              onChange={e => setContact(e.target.value)}
              placeholder="Nome do lead ou cliente"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 transition"
            />
          </div>

          {/* Local */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Local</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Endereço ou link"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 transition"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Observações..."
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400 transition resize-none"
            />
          </div>

          {/* Cor */}
          <div>
            <label className="text-xs text-gray-500 font-medium mb-2 block">Cor</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    outline: color === c.value ? `3px solid ${c.value}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
          {!isNew && onDelete && !confirming && (
            <button
              onClick={() => setConfirm(true)}
              className="text-red-500 hover:text-red-700 text-sm transition"
            >
              Excluir
            </button>
          )}
          {confirming && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Confirmar exclusão?</span>
              <button onClick={onDelete} className="text-red-600 text-sm font-medium hover:underline">Sim</button>
              <button onClick={() => setConfirm(false)} className="text-gray-400 text-sm hover:underline">Não</button>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar Evento' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── View Mensal ───────────────────────────────────────────────────────────

function MonthView({
  current,
  events,
  onDayClick,
  onEventClick,
}: {
  current: Date
  events: CalEvent[]
  onDayClick: (date: Date) => void
  onEventClick: (ev: CalEvent) => void
}) {
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function eventsOnDay(day: Date) {
    return events.filter(ev => {
      const s = parseISO(ev.start_at)
      return isSameDay(s, day)
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grade */}
      <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${days.length / 7}, 1fr)` }}>
        {days.map((day, idx) => {
          const dayEvents = eventsOnDay(day)
          const isCurrentMonth = isSameMonth(day, current)
          const todayFlag = isToday(day)

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-gray-200 p-1.5 cursor-pointer transition-colors min-h-[90px]
                ${isCurrentMonth ? 'bg-white hover:bg-blue-50/40' : 'bg-gray-50/60 hover:bg-gray-100/60'}
              `}
            >
              <div className="flex justify-start mb-1">
                <span
                  className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full transition
                    ${todayFlag ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}
                  `}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    className="w-full text-left text-[11px] font-medium text-white rounded px-1.5 py-0.5 truncate block transition-opacity hover:opacity-80"
                    style={{ backgroundColor: ev.color }}
                  >
                    {!ev.all_day && (
                      <span className="opacity-80 mr-1">
                        {format(parseISO(ev.start_at), 'HH:mm')}
                      </span>
                    )}
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-gray-500 pl-1">+{dayEvents.length - 3} mais</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── View Semanal ──────────────────────────────────────────────────────────

function WeekView({
  current,
  events,
  onSlotClick,
  onEventClick,
}: {
  current: Date
  events: CalEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (ev: CalEvent) => void
}) {
  const weekStart = startOfWeek(current, { weekStartsOn: 0 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const gridHeight = WEEK_HOURS.length * 60 * PX_PER_MIN
  const scrollRef = useRef<HTMLDivElement>(null)
  const now = new Date()
  const currentTimeTop = ((getHours(now) - 6) * 60 + getMinutes(now)) * PX_PER_MIN

  useEffect(() => {
    if (scrollRef.current) {
      const top = Math.max(0, currentTimeTop - 100)
      scrollRef.current.scrollTop = top
    }
  }, [])

  function eventsOnDay(day: Date) {
    return events.filter(ev => isSameDay(parseISO(ev.start_at), day) && !ev.all_day)
  }

  const isCurrentWeek = days.some(d => isToday(d))

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex border-b border-gray-200 bg-white">
        <div className="w-14 flex-shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className="flex-1 text-center py-2 border-l border-gray-100"
          >
            <p className="text-xs font-medium text-gray-500 uppercase">
              {format(day, 'EEE', { locale: ptBR })}
            </p>
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5
              ${isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-800'}
            `}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* Grade de horas */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: gridHeight }}>
          {/* Coluna de horas */}
          <div className="w-14 flex-shrink-0 relative">
            {WEEK_HOURS.map(h => (
              <div
                key={h}
                className="absolute flex items-start justify-end pr-2"
                style={{ top: (h - 6) * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
              >
                <span className="text-[10px] text-gray-400 -mt-2">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          <div className="flex-1 flex">
            {days.map((day, di) => (
              <div
                key={di}
                className="flex-1 border-l border-gray-200 relative"
                style={{ height: gridHeight }}
                onClick={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const relY = e.clientY - rect.top
                  const totalMins = relY / PX_PER_MIN
                  const hour = Math.floor(totalMins / 60) + 6
                  const min = Math.round((totalMins % 60) / 15) * 15
                  const d = new Date(day)
                  d.setHours(hour, min, 0, 0)
                  onSlotClick(d)
                }}
              >
                {/* Linhas de hora */}
                {WEEK_HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-gray-100"
                    style={{ top: (h - 6) * 60 * PX_PER_MIN }}
                  />
                ))}

                {/* Linha do horário atual */}
                {isCurrentWeek && isToday(day) && currentTimeTop >= 0 && (
                  <div
                    className="absolute w-full z-10 flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}

                {/* Eventos */}
                {eventsOnDay(day).map(ev => {
                  const top = eventTop(ev.start_at)
                  const height = eventHeight(ev.start_at, ev.end_at)
                  return (
                    <button
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                      className="absolute left-0.5 right-0.5 rounded text-white text-[11px] font-medium px-1.5 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity z-20"
                      style={{ top, height, backgroundColor: ev.color, minHeight: 20 }}
                    >
                      <p className="truncate leading-tight">{ev.title}</p>
                      {height > 30 && (
                        <p className="opacity-80 text-[10px] leading-tight">
                          {format(parseISO(ev.start_at), 'HH:mm')}–{format(parseISO(ev.end_at), 'HH:mm')}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const [current, setCurrent]           = useState(new Date())
  const [view, setView]                 = useState<View>('month')
  const [events, setEvents]             = useState<CalEvent[]>([])
  const [loading, setLoading]           = useState(true)
  const [googleConnected, setGoogleConn]= useState<boolean | null>(null)
  const [modalData, setModalData]       = useState<Partial<CalEvent> & { id?: string } | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/events')
      const data = await res.json()
      setEvents(data.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const checkGoogle = useCallback(async () => {
    const res = await fetch('/api/calendar/status')
    const data = await res.json()
    setGoogleConn(data.connected ?? false)
  }, [])

  useEffect(() => {
    loadEvents()
    checkGoogle()
  }, [loadEvents, checkGoogle])

  async function handleSave(data: Partial<CalEvent>) {
    if (editingEvent) {
      await fetch(`/api/calendar/events/${editingEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setModalData(null)
    setEditingEvent(null)
    await loadEvents()
  }

  async function handleDelete() {
    if (!editingEvent) return
    await fetch(`/api/calendar/events/${editingEvent.id}`, { method: 'DELETE' })
    setModalData(null)
    setEditingEvent(null)
    await loadEvents()
  }

  function openCreate(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const base = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours() || 9)}:00`
    const endD = new Date(date)
    endD.setHours((date.getHours() || 9) + 1, 0, 0, 0)
    const endBase = `${endD.getFullYear()}-${pad(endD.getMonth()+1)}-${pad(endD.getDate())}T${pad(endD.getHours())}:00`
    setEditingEvent(null)
    setModalData({ start_at: new Date(base).toISOString(), end_at: new Date(endBase).toISOString(), color: '#00a884' })
  }

  function openEdit(ev: CalEvent) {
    setEditingEvent(ev)
    setModalData(ev)
  }

  function prev() {
    if (view === 'month') setCurrent(subMonths(current, 1))
    else setCurrent(subWeeks(current, 1))
  }

  function next() {
    if (view === 'month') setCurrent(addMonths(current, 1))
    else setCurrent(addWeeks(current, 1))
  }

  const periodLabel = view === 'month'
    ? format(current, 'MMMM yyyy', { locale: ptBR })
    : (() => {
        const ws = startOfWeek(current, { weekStartsOn: 0 })
        const we = endOfWeek(current, { weekStartsOn: 0 })
        return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`
      })()

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">

      {/* Banner Google não conectado */}
      {googleConnected === false && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm text-blue-700 flex-1">
            Conecte sua Google Agenda para sincronizar eventos automaticamente.
          </p>
          <a
            href="/api/calendar/auth"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Conectar Google Agenda
          </a>
        </div>
      )}

      {/* Banner Google conectado */}
      {googleConnected === true && (
        <div className="flex items-center gap-2 px-5 py-2 bg-green-50 border-b border-green-100">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <p className="text-xs text-green-700 flex-1">Google Agenda conectada — eventos são sincronizados automaticamente.</p>
          <button
            onClick={async () => { await fetch('/api/calendar/status', { method: 'DELETE' }); setGoogleConn(false) }}
            className="text-xs text-green-600 hover:text-red-600 transition underline"
          >
            Desconectar
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        {/* Navegação */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button
            onClick={next}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <h2 className="text-base font-semibold text-gray-800 capitalize flex-1">{periodLabel}</h2>

        <button
          onClick={() => setCurrent(new Date())}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition"
        >
          Hoje
        </button>

        {/* Switch view */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['month', 'week'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>

        {/* Botão novo evento */}
        <button
          onClick={() => openCreate(new Date())}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Novo evento
        </button>
      </div>

      {/* Calendário */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Carregando eventos...</p>
          </div>
        </div>
      ) : view === 'month' ? (
        <MonthView
          current={current}
          events={events}
          onDayClick={openCreate}
          onEventClick={openEdit}
        />
      ) : (
        <WeekView
          current={current}
          events={events}
          onSlotClick={openCreate}
          onEventClick={openEdit}
        />
      )}

      {/* Modal */}
      {modalData && (
        <EventModal
          event={editingEvent ?? modalData}
          googleConnected={!!googleConnected}
          onClose={() => { setModalData(null); setEditingEvent(null) }}
          onSave={handleSave}
          onDelete={editingEvent ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
