'use client'

import { useState, useEffect, useRef } from 'react'

type Message = {
  id: string
  from_me: boolean
  body: string
  timestamp: string
  message_type: string
  participant_name?: string | null
  participant_jid?: string | null
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  remote_jid?: string | null
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

  useEffect(() => {
    setMessages([])
    setLoading(true)
    setError(null)
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [contact.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const res = await fetch(`/api/whatsapp/messages?contact_id=${contact.id}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
    setLoading(false)
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const grouped = groupMessagesByDate(messages)
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
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${avatarColor(contact.name)}`}>
          {isGroup
            ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            : getInitials(contact.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{contact.name}</p>
          <p className="text-[#8696a0] text-xs truncate">
            {isGroup ? 'Grupo' : contact.phone}
          </p>
        </div>
      </div>

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

              return (
                <div key={msg.id} className={`flex mb-1 ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${
                    msg.from_me
                      ? 'bg-[#005c4b] text-white rounded-br-none'
                      : 'bg-[#202c33] text-[#e9edef] rounded-bl-none'
                  }`}>
                    {showSender && (
                      <p className="text-xs font-semibold mb-1" style={{ color }}>
                        {senderName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.body || <span className="italic text-[#8696a0] text-xs">[mídia]</span>}
                    </p>
                    <p className={`text-[10px] mt-1 text-right ${msg.from_me ? 'text-[#8aaabf]' : 'text-[#8696a0]'}`}>
                      {formatTime(msg.timestamp)}
                      {msg.from_me && <span className="ml-1">✓✓</span>}
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
          <p className="text-red-400 text-xs">Erro ao enviar: {error}</p>
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-3 px-4 py-3 bg-[#202c33] flex-shrink-0">
        <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem"
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
  )
}
