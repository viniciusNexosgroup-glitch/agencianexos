'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Message = {
  id: string
  from_me: boolean
  body: string
  timestamp: string
  message_type: string
  participant_name?: string | null
  participant_jid?: string | null
  is_internal?: boolean
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  remote_jid?: string | null
}

type Lead = {
  id: string
  stage_id: string
  contact_id: string
}

type Agent = { id: string; name: string; email: string }

type InteractiveButton = { id: string; text: string }
type InteractiveListItem = { id: string; title: string; description?: string }
type InteractiveSection = { title: string; rows: InteractiveListItem[] }

type QuickReply = {
  id: string
  shortcut: string
  content: string
}

type ScheduledMessage = {
  id: string
  body: string
  send_at: string
  status: string
}

const AVATAR_COLORS = [
  'bg-teal-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
  'bg-orange-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-rose-600',
]

const SENDER_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a',
]

function senderColor(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.messages.push(msg)
    } else {
      groups.push({ date, messages: [msg] })
    }
  }
  return groups
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400 text-black rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  )
}

export function ChatPanel({
  contact,
  onClose,
  funnels,
}: {
  contact: Contact
  onClose: () => void
  funnels?: { id: string; name: string; crm_stages: { id: string; name: string }[] }[]
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Quick Replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrSelected, setQrSelected] = useState(0)
  const quickRepliesRef = useRef<HTMLDivElement>(null)

  // Notas internas
  const [isInternal, setIsInternal] = useState(false)

  // Agendamento
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)

  // Busca no histórico
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Etapa do funil
  const [lead, setLead] = useState<Lead | null>(null)
  const [showStageDropdown, setShowStageDropdown] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)
  const stageDropdownRef = useRef<HTMLDivElement>(null)

  // Transferência de conversa
  const [showTransfer, setShowTransfer] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [transferTo, setTransferTo] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)

  // Mensagens interativas
  const [showInteractive, setShowInteractive] = useState(false)
  const [interactiveTab, setInteractiveTab] = useState<'buttons' | 'list'>('buttons')
  const [iTitle, setITitle] = useState('')
  const [iBody, setIBody] = useState('')
  const [iFooter, setIFooter] = useState('')
  const [iButtons, setIButtons] = useState<InteractiveButton[]>([{ id: '1', text: '' }, { id: '2', text: '' }])
  const [iListBtn, setIListBtn] = useState('')
  const [iSections, setISections] = useState<InteractiveSection[]>([{ title: '', rows: [{ id: '1', title: '' }] }])
  const [sendingInteractive, setSendingInteractive] = useState(false)

  useEffect(() => {
    setMessages([])
    setLoading(true)
    setError(null)
    load()
    loadLead()
    loadCurrentAgent()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [contact.id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setShowStageDropdown(false)
      }
    }
    if (showStageDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showStageDropdown])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  useEffect(() => {
    if (showSchedule) {
      loadScheduled()
    }
  }, [showSchedule, contact.id])

  // Fechar dropdown de quick replies ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false)
      }
    }
    if (showQuickReplies) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showQuickReplies])

  async function load() {
    const res = await fetch(`/api/whatsapp/messages?contact_id=${contact.id}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
    setLoading(false)
  }

  async function loadLead() {
    try {
      const res = await fetch(`/api/whatsapp/leads?contact_id=${contact.id}`)
      const data = await res.json()
      setLead(data.lead ?? null)
    } catch {
      setLead(null)
    }
  }

  async function loadCurrentAgent() {
    try {
      const res = await fetch(`/api/whatsapp/transfers?contact_id=${contact.id}`)
      const data = await res.json()
      setCurrentAgent(data.current_agent ?? null)
    } catch {
      setCurrentAgent(null)
    }
  }

  async function loadAgents() {
    if (agents.length > 0) return
    const res = await fetch('/api/whatsapp/agents')
    const data = await res.json()
    setAgents(data.agents ?? [])
  }

  async function transfer() {
    if (!transferTo || transferring) return
    setTransferring(true)
    await fetch('/api/whatsapp/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, to_agent_id: transferTo, note: transferNote }),
    })
    setTransferring(false)
    setShowTransfer(false)
    setTransferNote('')
    await loadCurrentAgent()
  }

  async function sendInteractive() {
    if (sendingInteractive) return
    setSendingInteractive(true)
    try {
      const body: Record<string, unknown> = {
        type: interactiveTab,
        instanceName: contact.instance_name,
        contactId: contact.id,
        phone: contact.remote_jid || contact.phone,
        title: iTitle,
        body: iBody,
        footer: iFooter,
      }
      if (interactiveTab === 'buttons') {
        body.buttons = iButtons.filter(b => b.text.trim())
      } else {
        body.buttonText = iListBtn || 'Ver opções'
        body.sections = iSections.map(s => ({
          title: s.title,
          rows: s.rows.filter(r => r.title.trim()).map(r => ({
            rowId: r.id,
            title: r.title,
            description: r.description || '',
          })),
        })).filter(s => s.rows.length > 0)
      }
      const res = await fetch('/api/whatsapp/interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setError(data.error) } else {
        setShowInteractive(false)
        setITitle(''); setIBody(''); setIFooter(''); setIListBtn('')
        setIButtons([{ id: '1', text: '' }, { id: '2', text: '' }])
        setISections([{ title: '', rows: [{ id: '1', title: '' }] }])
        setTimeout(load, 1500)
      }
    } finally {
      setSendingInteractive(false)
    }
  }

  async function updateStage(stageId: string) {
    if (updatingStage) return
    setUpdatingStage(true)
    try {
      const funnel = funnels?.find(f => f.crm_stages.some(s => s.id === stageId))
      const res = await fetch('/api/whatsapp/leads', {
        method: lead ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          lead
            ? { id: lead.id, stageId, funnelId: funnel?.id }
            : { contactId: contact.id, stageId, funnelId: funnel?.id, title: contact.name || 'Lead' }
        ),
      })
      const data = await res.json()
      if (data.lead) setLead(data.lead)
    } finally {
      setUpdatingStage(false)
      setShowStageDropdown(false)
    }
  }

  async function loadQuickReplies() {
    setQrLoading(true)
    try {
      const res = await fetch('/api/whatsapp/quick-replies')
      const data = await res.json()
      setQuickReplies(data.quickReplies ?? data ?? [])
    } catch {
      setQuickReplies([])
    } finally {
      setQrLoading(false)
    }
  }

  async function loadScheduled() {
    setLoadingScheduled(true)
    try {
      const res = await fetch(`/api/whatsapp/scheduled?contact_id=${contact.id}`)
      const data = await res.json()
      setScheduledMessages(data.scheduled ?? [])
    } catch {
      setScheduledMessages([])
    } finally {
      setLoadingScheduled(false)
    }
  }

  async function cancelScheduled(id: string) {
    await fetch(`/api/whatsapp/scheduled?id=${id}`, { method: 'DELETE' })
    setScheduledMessages(prev => prev.filter(s => s.id !== id))
  }

  async function scheduleMessage() {
    if (!text.trim() || !scheduleAt || scheduling) return
    setScheduling(true)
    try {
      const res = await fetch('/api/whatsapp/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          instance_name: contact.instance_name,
          body: text.trim(),
          send_at: new Date(scheduleAt).toISOString(),
        }),
      })
      const data = await res.json()
      if (!data.error) {
        setText('')
        setScheduleAt('')
        setShowSchedule(false)
        await loadScheduled()
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao agendar mensagem.')
    } finally {
      setScheduling(false)
    }
  }

  async function send() {
    if (!text.trim() || sending) return
    const body = text.trim()
    setSending(true)
    setError(null)
    setText('')

    const optimistic: Message = {
      id: crypto.randomUUID(),
      from_me: true,
      body,
      timestamp: new Date().toISOString(),
      message_type: 'text',
      is_internal: isInternal,
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: contact.instance_name,
          contactId: contact.id,
          phone: contact.remote_jid || contact.phone,
          text: body,
          is_internal: isInternal,
        }),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setText(body)
      } else {
        setTimeout(load, 1500)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(body)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Navegar no dropdown de quick replies
    if (showQuickReplies) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setQrSelected(s => Math.min(s + 1, filteredQR.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setQrSelected(s => Math.max(s - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredQR[qrSelected]) selectQuickReply(filteredQR[qrSelected])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowQuickReplies(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)

    if (val === '/' || val.startsWith('/')) {
      if (!showQuickReplies) {
        setShowQuickReplies(true)
        setQrSelected(0)
        if (quickReplies.length === 0) loadQuickReplies()
      }
    } else {
      setShowQuickReplies(false)
    }
  }

  function selectQuickReply(qr: QuickReply) {
    setText(qr.content)
    setShowQuickReplies(false)
    setQrSelected(0)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const len = qr.content.length
        inputRef.current.setSelectionRange(len, len)
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 128) + 'px'
      }
    }, 0)
  }

  const searchTerm = text.startsWith('/') ? text.slice(1).toLowerCase() : ''
  const filteredQR = searchTerm
    ? quickReplies.filter(q =>
        q.shortcut.toLowerCase().includes(searchTerm) ||
        q.content.toLowerCase().includes(searchTerm)
      )
    : quickReplies

  const displayedMessages = searchQuery.trim()
    ? messages.filter(m => m.body?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const grouped = groupMessagesByDate(displayedMessages)
  const isGroup = contact.remote_jid?.endsWith('@g.us') || contact.phone?.includes('@g.us')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#202c33] flex-shrink-0">
        <button
          onClick={onClose}
          className="md:hidden text-[#8696a0] hover:text-white transition p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {(contact as any).profile_pic_url
          ? <img src={(contact as any).profile_pic_url} alt={contact.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" onError={e => { const el = e.target as HTMLImageElement; el.style.display='none'; (el.nextElementSibling as HTMLElement)?.style.removeProperty('display') }} />
          : null
        }
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${avatarColor(contact.name)}`} style={(contact as any).profile_pic_url ? { display: 'none' } : {}}>
          {isGroup
            ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            : getInitials(contact.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          {showSearch ? (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar nas mensagens..."
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded px-3 py-1 outline-none placeholder-[#8696a0]"
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowSearch(false)
                  setSearchQuery('')
                }
              }}
            />
          ) : (
            <>
              <p className="text-white font-medium text-sm truncate">{contact.name}</p>
              <p className="text-[#8696a0] text-xs truncate">
                {isGroup ? 'Grupo' : contact.phone}
              </p>
            </>
          )}
        </div>
        {/* Seletor de etapa do funil */}
        {funnels && funnels.length > 0 && (
          <div className="relative" ref={stageDropdownRef}>
            <button
              onClick={() => setShowStageDropdown(v => !v)}
              title="Mover para etapa do funil"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition max-w-[130px] ${
                showStageDropdown
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="truncate">
                {lead
                  ? (funnels.flatMap(f => f.crm_stages).find(s => s.id === lead.stage_id)?.name ?? 'Etapa')
                  : 'Etapa'}
              </span>
            </button>

            {showStageDropdown && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-[#2a3942]">
                  <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide">Mover para etapa</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {funnels.map(funnel => (
                    <div key={funnel.id}>
                      <p className="px-3 py-1.5 text-[#8696a0] text-[10px] font-semibold uppercase tracking-wider bg-[#0b141a]">
                        {funnel.name}
                      </p>
                      {funnel.crm_stages.map(stage => (
                        <button
                          key={stage.id}
                          onClick={() => updateStage(stage.id)}
                          disabled={updatingStage}
                          className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                            lead?.stage_id === stage.id
                              ? 'text-[#00a884] bg-[#0b141a]'
                              : 'text-[#e9edef] hover:bg-[#2a3942]'
                          }`}
                        >
                          {lead?.stage_id === stage.id && (
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className={lead?.stage_id === stage.id ? '' : 'ml-5'}>{stage.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão mensagem interativa */}
        {!isGroup && (
          <button
            onClick={() => setShowInteractive(v => !v)}
            title="Enviar mensagem interativa (botões ou lista)"
            className={`p-1.5 rounded-full transition ${showInteractive ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
            </svg>
          </button>
        )}

        {/* Botão transferir */}
        <button
          onClick={() => { setShowTransfer(v => !v); loadAgents() }}
          title={currentAgent ? `Atribuído a: ${currentAgent.name}` : 'Transferir conversa'}
          className={`p-1.5 rounded-full transition ${showTransfer ? 'text-[#00a884]' : currentAgent ? 'text-indigo-400' : 'text-[#8696a0] hover:text-white'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Botão de busca */}
        <button
          onClick={() => {
            setShowSearch(v => !v)
            if (showSearch) setSearchQuery('')
          }}
          className={`p-1.5 rounded-full transition ${showSearch ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
          title="Buscar mensagens"
        >
          {showSearch ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Busca ativa: badge com contagem */}
      {showSearch && searchQuery && (
        <div className="bg-[#2a3942] px-4 py-1.5 flex-shrink-0">
          <p className="text-[#8696a0] text-xs">
            {displayedMessages.length === 0
              ? 'Nenhuma mensagem encontrada'
              : `${displayedMessages.length} mensagem(ns) encontrada(s)`}
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#0b141a',
        }}
      >
        {loading && (
          <p className="text-[#8696a0] text-sm text-center py-4">Carregando mensagens...</p>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
              Nenhuma mensagem ainda
            </span>
          </div>
        )}
        {!loading && messages.length > 0 && displayedMessages.length === 0 && searchQuery && (
          <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
              Nenhuma mensagem corresponde à busca
            </span>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-1.5 rounded-lg">
                {group.date}
              </span>
            </div>
            {group.messages.map((msg, idx) => {
              const senderName = msg.participant_name || ''
              const showSender = isGroup && !msg.from_me && senderName &&
                (idx === 0 || group.messages[idx - 1].participant_jid !== msg.participant_jid || group.messages[idx - 1].from_me)
              const color = senderName ? senderColor(senderName) : '#8696a0'
              const isIntMsg = msg.is_internal

              return (
                <div key={msg.id} className={`flex mb-1 ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[65%] px-3 py-2 rounded-lg shadow-sm relative ${
                      isIntMsg
                        ? 'border border-yellow-600 rounded-br-none'
                        : msg.from_me
                          ? 'bg-[#005c4b] text-white rounded-br-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-bl-none'
                    }`}
                    style={isIntMsg ? { backgroundColor: '#2d3748', color: '#e9edef' } : undefined}
                  >
                    {/* Badge nota interna */}
                    {isIntMsg && (
                      <span className="inline-block text-yellow-400 text-[10px] font-semibold uppercase tracking-wide mb-1 border border-yellow-700 rounded px-1">
                        Interno
                      </span>
                    )}
                    {showSender && (
                      <p className="text-xs font-semibold mb-1" style={{ color }}>
                        {senderName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.body
                        ? (searchQuery ? highlightText(msg.body, searchQuery) : msg.body)
                        : <span className="italic text-[#8696a0] text-xs">[mídia]</span>}
                    </p>
                    <p className={`text-[10px] mt-1 text-right ${msg.from_me ? 'text-[#8aaabf]' : 'text-[#8696a0]'}`}>
                      {formatTime(msg.timestamp)}
                      {msg.from_me && !isIntMsg && <span className="ml-1">✓✓</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
          <p className="text-red-400 text-xs">Erro: {error}</p>
        </div>
      )}

      {/* Painel de agendamento */}
      {showSchedule && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-2 flex-shrink-0">
          <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-2">Agendar mensagem</p>
          <div className="flex gap-2 mb-3">
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={e => setScheduleAt(e.target.value)}
              className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] transition"
            />
            <button
              onClick={scheduleMessage}
              disabled={!text.trim() || !scheduleAt || scheduling}
              className="bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white text-xs px-3 py-2 rounded-lg transition font-medium"
            >
              {scheduling ? 'Agendando...' : 'Agendar'}
            </button>
          </div>

          {/* Lista de agendadas */}
          {loadingScheduled ? (
            <p className="text-[#8696a0] text-xs mb-2">Carregando agendamentos...</p>
          ) : scheduledMessages.length > 0 ? (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              <p className="text-[#8696a0] text-xs font-medium mb-1">Pendentes:</p>
              {scheduledMessages.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-[#2a3942] rounded px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#e9edef] text-xs truncate">{s.body}</p>
                    <p className="text-[#8696a0] text-[10px]">
                      {new Date(s.send_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelScheduled(s.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 border border-red-900 rounded transition flex-shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#8696a0] text-xs">Nenhum agendamento pendente.</p>
          )}
        </div>
      )}

      {/* Painel de transferência */}
      {showTransfer && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-3 flex-shrink-0">
          <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-2">Transferir conversa</p>
          {currentAgent && (
            <p className="text-indigo-400 text-xs mb-2">Atribuído atual: <strong>{currentAgent.name}</strong></p>
          )}
          <div className="space-y-2">
            <select
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] transition"
            >
              <option value="">Selecionar agente...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
              ))}
            </select>
            <input
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              placeholder="Nota de transferência (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition"
            />
            <div className="flex gap-2">
              <button
                onClick={transfer}
                disabled={!transferTo || transferring}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium py-2 rounded-lg transition"
              >
                {transferring ? 'Transferindo...' : 'Transferir'}
              </button>
              <button
                onClick={() => setShowTransfer(false)}
                className="px-3 py-2 text-xs text-[#8696a0] hover:text-white border border-[#3b4a54] rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de mensagem interativa */}
      {showInteractive && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-3 flex-shrink-0 max-h-80 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setInteractiveTab('buttons')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${interactiveTab === 'buttons' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0]'}`}
            >Botões</button>
            <button
              onClick={() => setInteractiveTab('list')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${interactiveTab === 'list' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0]'}`}
            >Lista</button>
          </div>
          <div className="space-y-2">
            <input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder="Título (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
            <textarea value={iBody} onChange={e => setIBody(e.target.value)} placeholder="Corpo da mensagem *" rows={2}
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition resize-none" />
            <input value={iFooter} onChange={e => setIFooter(e.target.value)} placeholder="Rodapé (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
            {interactiveTab === 'buttons' ? (
              <div className="space-y-1.5">
                <p className="text-[#8696a0] text-[10px] uppercase tracking-wide">Botões (máx. 3)</p>
                {iButtons.map((btn, i) => (
                  <div key={btn.id} className="flex gap-1.5">
                    <input value={btn.text} onChange={e => setIButtons(prev => prev.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
                      placeholder={`Botão ${i + 1}`}
                      className="flex-1 bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
                    {iButtons.length > 1 && (
                      <button onClick={() => setIButtons(prev => prev.filter((_, j) => j !== i))} className="text-[#8696a0] hover:text-red-400 transition px-1">×</button>
                    )}
                  </div>
                ))}
                {iButtons.length < 3 && (
                  <button onClick={() => setIButtons(prev => [...prev, { id: String(Date.now()), text: '' }])}
                    className="text-[#8696a0] hover:text-white text-xs transition">+ Adicionar botão</button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <input value={iListBtn} onChange={e => setIListBtn(e.target.value)} placeholder="Texto do botão principal *"
                  className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
                {iSections.map((sec, si) => (
                  <div key={si} className="bg-[#0b141a] rounded-lg p-2 space-y-1.5">
                    <input value={sec.title} onChange={e => setISections(prev => prev.map((s, j) => j === si ? { ...s, title: e.target.value } : s))}
                      placeholder="Título da seção" className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1 outline-none border border-[#3b4a54] placeholder-[#8696a0] transition" />
                    {sec.rows.map((row, ri) => (
                      <input key={row.id} value={row.title}
                        onChange={e => setISections(prev => prev.map((s, j) => j === si ? { ...s, rows: s.rows.map((r, k) => k === ri ? { ...r, title: e.target.value } : r) } : s))}
                        placeholder={`Item ${ri + 1}`} className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1 outline-none border border-[#3b4a54] placeholder-[#8696a0] transition" />
                    ))}
                    <button onClick={() => setISections(prev => prev.map((s, j) => j === si ? { ...s, rows: [...s.rows, { id: String(Date.now()), title: '' }] } : s))}
                      className="text-[#8696a0] hover:text-white text-xs transition">+ Item</button>
                  </div>
                ))}
                <button onClick={() => setISections(prev => [...prev, { title: '', rows: [{ id: String(Date.now()), title: '' }] }])}
                  className="text-[#8696a0] hover:text-white text-xs transition">+ Seção</button>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={sendInteractive} disabled={!iBody.trim() || sendingInteractive}
                className="flex-1 bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white text-xs font-medium py-2 rounded-lg transition">
                {sendingInteractive ? 'Enviando...' : 'Enviar'}
              </button>
              <button onClick={() => setShowInteractive(false)}
                className="px-3 py-2 text-xs text-[#8696a0] hover:text-white border border-[#3b4a54] rounded-lg transition">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 relative">
        {/* Dropdown quick replies */}
        {showQuickReplies && (
          <div
            ref={quickRepliesRef}
            className="absolute bottom-full left-4 right-4 mb-1 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[#2a3942] flex items-center justify-between">
              <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide">Respostas rápidas</p>
              <button
                onClick={() => setShowQuickReplies(false)}
                className="text-[#8696a0] hover:text-white transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {qrLoading ? (
                <p className="text-[#8696a0] text-xs text-center py-3">Carregando...</p>
              ) : filteredQR.length === 0 ? (
                <p className="text-[#8696a0] text-xs text-center py-3">Nenhuma resposta encontrada</p>
              ) : (
                filteredQR.map((qr, i) => (
                  <button
                    key={qr.id}
                    onClick={() => selectQuickReply(qr)}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-[#2a3942] transition ${i === qrSelected ? 'bg-[#2a3942]' : ''}`}
                  >
                    <span className="text-[#00a884] font-mono text-xs bg-[#0b141a] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                      /{qr.shortcut}
                    </span>
                    <span className="text-[#e9edef] text-sm truncate leading-relaxed">
                      {qr.content.length > 80 ? qr.content.slice(0, 80) + '…' : qr.content}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className={`flex items-end gap-2 px-4 py-3 bg-[#202c33] ${isInternal ? 'border-t-2 border-yellow-600' : ''}`}>
          {/* Botão nota interna */}
          <button
            onClick={() => setIsInternal(v => !v)}
            title={isInternal ? 'Modo nota interna (clique para desativar)' : 'Escrever nota interna'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
              isInternal ? 'bg-yellow-600 text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Botão agendar */}
          <button
            onClick={() => setShowSchedule(v => !v)}
            title="Agendar mensagem"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
              showSchedule ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Textarea */}
          <div className={`flex-1 rounded-lg px-4 py-2 ${isInternal ? 'bg-[#2d3748] border border-yellow-700' : 'bg-[#2a3942]'}`}>
            {isInternal && (
              <p className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wide mb-1">Nota interna</p>
            )}
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={isInternal ? 'Escrever nota interna...' : 'Digite uma mensagem ou / para respostas rápidas'}
              rows={1}
              className="w-full bg-transparent text-[#e9edef] text-sm outline-none placeholder-[#8696a0] resize-none max-h-32 leading-relaxed"
              style={{ height: 'auto' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
          </div>

          {/* Botão enviar */}
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white flex items-center justify-center transition flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
