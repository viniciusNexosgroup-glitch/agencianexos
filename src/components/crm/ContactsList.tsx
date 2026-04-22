'use client'

import { useState, useEffect } from 'react'
import { ChatPanel } from './ChatPanel'

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  last_message_at: string | null
}

type Lead = {
  id: string
  title: string
  crm_stages: { name: string } | null
}

export function ContactsList({ funnels }: { funnels: { id: string; name: string; crm_stages: { id: string; name: string }[] }[] }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [leads, setLeads] = useState<Record<string, Lead[]>>({})
  const [loading, setLoading] = useState(true)
  const [chatContact, setChatContact] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')
  const [addingLead, setAddingLead] = useState<string | null>(null)
  const [stageId, setStageId] = useState('')
  const [funnelId, setFunnelId] = useState('')

  async function load() {
    const res = await fetch('/api/whatsapp/contacts')
    const data = await res.json()
    setContacts(data.contacts ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addToFunnel(contactId: string) {
    if (!stageId || !funnelId) return
    await fetch('/api/whatsapp/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, stageId, funnelId, title: 'Novo Lead' }),
    })
    setAddingLead(null)
    setStageId('')
    setFunnelId('')
  }

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const selectedFunnel = funnels.find(f => f.id === funnelId)

  if (loading) return <p className="text-slate-400 text-sm">Carregando contatos...</p>

  return (
    <div className="flex gap-6 h-full">
      {/* Contacts list */}
      <div className={`flex-1 min-w-0 ${chatContact ? 'hidden md:block' : ''}`}>
        <div className="mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition placeholder-slate-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-slate-700 rounded-xl">
            {contacts.length === 0
              ? 'Nenhum contato ainda. Conecte um WhatsApp e aguarde mensagens chegarem.'
              : 'Nenhum contato encontrado.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(contact => (
              <div
                key={contact.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-600 transition"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                  <p className="text-slate-400 text-xs">{contact.phone} · <span className="text-slate-500">{contact.instance_name}</span></p>
                  {contact.last_message_at && (
                    <p className="text-slate-600 text-xs mt-0.5">
                      {new Date(contact.last_message_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-3 flex-shrink-0">
                  {addingLead === contact.id ? (
                    <div className="flex flex-col gap-2 items-end">
                      <select
                        value={funnelId}
                        onChange={e => { setFunnelId(e.target.value); setStageId('') }}
                        className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none"
                      >
                        <option value="">Funil...</option>
                        {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      {selectedFunnel && (
                        <select
                          value={stageId}
                          onChange={e => setStageId(e.target.value)}
                          className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-slate-600 outline-none"
                        >
                          <option value="">Etapa...</option>
                          {selectedFunnel.crm_stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={() => addToFunnel(contact.id)}
                          disabled={!stageId}
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-2 py-1 rounded transition"
                        >
                          Adicionar
                        </button>
                        <button
                          onClick={() => setAddingLead(null)}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setAddingLead(contact.id)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 transition"
                      >
                        + Funil
                      </button>
                      <button
                        onClick={() => setChatContact(contact)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded border border-indigo-800 transition"
                      >
                        Chat
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat panel */}
      {chatContact && (
        <div className="w-full md:w-96 flex-shrink-0 h-[600px]">
          <ChatPanel contact={chatContact} onClose={() => setChatContact(null)} />
        </div>
      )}
    </div>
  )
}
