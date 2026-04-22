'use client'

import { useState, useEffect, useRef } from 'react'

type Message = {
  id: string
  from_me: boolean
  body: string
  timestamp: string
  message_type: string
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
}

export function ChatPanel({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [contact.id])

  async function load() {
    const res = await fetch(`/api/whatsapp/messages?contact_id=${contact.id}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
    setLoading(false)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const optimistic: Message = {
      id: crypto.randomUUID(),
      from_me: true,
      body: text,
      timestamp: new Date().toISOString(),
      message_type: 'text',
    }
    setMessages(prev => [...prev, optimistic])
    setText('')

    await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName: contact.instance_name,
        contactId: contact.id,
        phone: contact.phone,
        text: optimistic.body,
      }),
    })
    setSending(false)
    setTimeout(load, 1000)
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div>
          <p className="text-white font-semibold text-sm">{contact.name}</p>
          <p className="text-slate-400 text-xs">{contact.phone}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition text-xl leading-none">&times;</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {loading && <p className="text-slate-500 text-sm text-center">Carregando mensagens...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center">Nenhuma mensagem ainda.</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
              msg.from_me
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-slate-800 text-slate-100 rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap break-words">{msg.body || <span className="italic text-slate-400">[mídia]</span>}</p>
              <p className={`text-[10px] mt-1 ${msg.from_me ? 'text-indigo-200' : 'text-slate-500'} text-right`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-3 flex gap-2 bg-slate-900/60">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-slate-500 border border-slate-700 focus:border-indigo-500 transition"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
