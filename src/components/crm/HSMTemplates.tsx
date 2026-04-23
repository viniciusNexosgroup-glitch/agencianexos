'use client'

import { useState, useEffect } from 'react'

type Template = {
  id: string
  name: string
  status: string
  language: string
  category: string
  components: { type: string; text?: string; format?: string }[]
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
}

function templateBody(t: Template) {
  return t.components.find(c => c.type === 'BODY')?.text ?? ''
}

function SendTemplateModal({
  template,
  onClose,
}: {
  template: Template
  onClose: () => void
}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [instances, setInstances] = useState<{ instance_name: string }[]>([])
  const [contactId, setContactId] = useState('')
  const [instanceName, setInstanceName] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/whatsapp/contacts').then(r => r.json()),
      fetch('/api/whatsapp/instance').then(r => r.json()),
    ]).then(([cData, iData]) => {
      const cs = cData.contacts ?? []
      setContacts(cs)
      const is = iData.instances ?? iData ?? []
      setInstances(is)
      if (is.length > 0) setInstanceName(is[0].instance_name)
    })
  }, [])

  const filtered = contacts.filter(c =>
    !c.phone.includes('@g.us') &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
  )
  const selected = contacts.find(c => c.id === contactId)

  async function send() {
    if (!contactId || !instanceName || sending) return
    setSending(true)
    setError('')
    const contact = contacts.find(c => c.id === contactId)
    const res = await fetch('/api/whatsapp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        contactId,
        phone: contact?.phone,
        templateName: template.name,
        language: template.language,
        components: [],
      }),
    })
    const data = await res.json()
    setSending(false)
    if (data.error) { setError(data.error); return }
    setSuccess(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold">Enviar Template</h2>
            <p className="text-slate-500 text-xs mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Template enviado!</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Preview */}
            <div className="bg-[#005c4b]/20 border border-[#005c4b]/40 rounded-xl p-3">
              <p className="text-[#8696a0] text-[10px] uppercase tracking-wider mb-1.5">Prévia do template</p>
              <p className="text-[#e9edef] text-sm whitespace-pre-wrap leading-relaxed">
                {templateBody(template) || '(sem corpo)'}
              </p>
            </div>

            {/* Instância */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Instância WhatsApp</label>
              <select
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition"
              >
                {instances.map(i => (
                  <option key={i.instance_name} value={i.instance_name}>{i.instance_name}</option>
                ))}
              </select>
            </div>

            {/* Contato */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Contato</label>
              <input
                value={selected ? `${selected.name} — ${selected.phone}` : search}
                onChange={e => { setSearch(e.target.value); setContactId('') }}
                placeholder="Buscar contato..."
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 placeholder-slate-500 transition mb-1"
              />
              {!contactId && search && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
                  {filtered.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setContactId(c.id); setSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm text-slate-300 transition"
                    >
                      {c.name} <span className="text-slate-500 text-xs">{c.phone}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-slate-500 text-xs px-3 py-2">Nenhum resultado</p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={send}
                disabled={!contactId || !instanceName || sending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function HSMTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendingTemplate, setSendingTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetch('/api/whatsapp/templates')
      .then(r => r.json())
      .then(data => {
        setTemplates(data.templates ?? [])
        if (data.error) setError(data.error)
        setLoading(false)
      })
  }, [])

  const categoryLabel: Record<string, string> = {
    MARKETING: 'Marketing',
    UTILITY: 'Utilitário',
    AUTHENTICATION: 'Autenticação',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Carregando templates...
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-white text-lg font-semibold">Templates HSM (Meta)</h2>
        <p className="text-slate-500 text-sm mt-1">
          Templates aprovados pela Meta para envio de mensagens proativas (após 24h de inatividade).
        </p>
      </div>

      {error && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 mb-6">
          <p className="text-amber-400 text-sm font-medium mb-1">Configuração necessária</p>
          <p className="text-amber-300/70 text-xs">{error}</p>
          <p className="text-amber-300/70 text-xs mt-1">
            Configure as variáveis de ambiente <code className="bg-amber-900/30 px-1 rounded">META_WABA_ID</code> e{' '}
            <code className="bg-amber-900/30 px-1 rounded">META_ACCESS_TOKEN</code> no EasyPanel.
          </p>
        </div>
      )}

      {templates.length === 0 && !error ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p>Nenhum template aprovado encontrado.</p>
          <p className="text-slate-600 text-xs mt-1">Crie templates no Meta Business Manager e aguarde aprovação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="bg-[#0d1117] border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium truncate">{t.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800 flex-shrink-0">
                      {t.status}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex-shrink-0">
                      {categoryLabel[t.category] ?? t.category}
                    </span>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">{t.language}</span>
                  </div>
                  {templateBody(t) && (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mt-1">
                      {templateBody(t)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSendingTemplate(t)}
                  className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
                >
                  Enviar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendingTemplate && (
        <SendTemplateModal
          template={sendingTemplate}
          onClose={() => setSendingTemplate(null)}
        />
      )}
    </div>
  )
}
