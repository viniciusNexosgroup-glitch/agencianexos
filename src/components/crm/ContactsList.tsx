'use client'

import { useState, useEffect } from 'react'
import { ChatPanel } from './ChatPanel'

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  last_message_at: string | null
  remote_jid: string | null
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-teal-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
  'bg-orange-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-rose-600',
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function isGroup(contact: Contact) {
  return contact.remote_jid?.endsWith('@g.us') || contact.phone?.includes('@g.us')
}

function formatTime(ts: string | null) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ContactsList({ funnels }: { funnels: { id: string; name: string; crm_stages: { id: string; name: string }[] }[] }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [chatContact, setChatContact] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    const res = await fetch('/api/whatsapp/contacts')
    const data = await res.json()
    setContacts(data.contacts ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  return (
    <div className="flex h-[calc(100vh-160px)] rounded-xl overflow-hidden border border-[#222e35]">
      {/* Sidebar */}
      <div className={`flex flex-col bg-[#111b21] ${chatContact ? 'hidden md:flex w-[360px] flex-shrink-0' : 'flex-1 md:w-[360px] md:flex-shrink-0'}`}>
        {/* Sidebar header */}
        <div className="px-4 py-3 bg-[#202c33] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-bold">
            WA
          </div>
          <span className="text-white font-semibold flex-1">Conversas</span>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-[#111b21]">
          <div className="flex items-center bg-[#202c33] rounded-lg px-3 gap-2">
            <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar ou começar uma conversa"
              className="flex-1 bg-transparent text-white text-sm py-2 outline-none placeholder-[#8696a0]"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-[#8696a0] text-sm text-center py-8">Carregando...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-[#8696a0] text-sm text-center py-8 px-4">
              {contacts.length === 0
                ? 'Nenhuma conversa ainda. Aguarde mensagens chegarem.'
                : 'Nenhum resultado.'}
            </p>
          )}
          {filtered.map(contact => (
            <button
              key={contact.id}
              onClick={() => setChatContact(contact)}
              className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#202c33] transition border-b border-[#222e35] ${
                chatContact?.id === contact.id ? 'bg-[#2a3942]' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${avatarColor(contact.name)}`}>
                {isGroup(contact)
                  ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  : getInitials(contact.name)
                }
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">{contact.name}</span>
                  {contact.last_message_at && (
                    <span className="text-[#8696a0] text-xs flex-shrink-0 ml-2">
                      {formatTime(contact.last_message_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isGroup(contact)
                    ? <span className="text-[#8696a0] text-xs truncate">Grupo</span>
                    : <span className="text-[#8696a0] text-xs truncate">{contact.phone}</span>
                  }
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col bg-[#0b141a] ${!chatContact ? 'hidden md:flex' : 'flex'}`}>
        {chatContact ? (
          <ChatPanel
            contact={chatContact}
            onClose={() => setChatContact(null)}
            funnels={funnels}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-[#8696a0]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <h3 className="text-[#e9edef] text-xl font-light mb-2">WhatsApp CRM</h3>
            <p className="text-[#8696a0] text-sm">Selecione uma conversa para abrir</p>
          </div>
        )}
      </div>
    </div>
  )
}
