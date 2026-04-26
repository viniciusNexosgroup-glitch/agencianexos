'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceStep = {
  id?: string
  position: number
  delay_hours: number
  body: string
}

type Sequence = {
  id: string
  name: string
  trigger_event: string
  is_active?: boolean
  created_at: string
  sequence_steps: SequenceStep[]
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  last_message_at: string | null
  unread_count: number
}

type Enrollment = {
  id: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  current_step: number
  next_send_at: string | null
  enrolled_at: string
  whatsapp_contacts: { id: string; name: string; phone: string } | null
  sequences: { id: string; name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(ts: string | null) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Menos de 1h'
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const DEFAULT_STEPS: SequenceStep[] = [
  { position: 0, delay_hours: 24,  body: 'Olá {nome}! Tudo bem? Gostaria de saber se ficou alguma dúvida sobre o que conversamos.' },
  { position: 1, delay_hours: 48,  body: 'Oi {nome}! Passando para ver se posso ajudar com alguma coisa 😊' },
  { position: 2, delay_hours: 72,  body: '{nome}, ainda tenho uma proposta especial reservada para você. Posso te contar mais?' },
  { position: 3, delay_hours: 120, body: 'Olá {nome}! Vi que você ainda não retornou. Estou à disposição quando quiser.' },
  { position: 4, delay_hours: 168, body: 'Oi {nome}, última chamada! Posso te oferecer condições especiais hoje. Bora?' },
  { position: 5, delay_hours: 216, body: '{nome}, obrigado pelo contato! Fico à disposição para quando precisar 🙂' },
  { position: 6, delay_hours: 336, body: 'Olá {nome}! Voltei para ver se posso ser útil. Qualquer coisa estou aqui!' },
]

// ─── Modal Nova Sequência ─────────────────────────────────────────────────────

function NewSequenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (seq: Sequence) => void }) {
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS.map(s => ({ ...s })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateStep(i: number, field: 'delay_hours' | 'body', value: string | number) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addStep() {
    const last = steps[steps.length - 1]
    setSteps(prev => [...prev, { position: prev.length, delay_hours: (last?.delay_hours ?? 24) + 24, body: '' }])
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, position: idx })))
  }

  async function save() {
    if (!name.trim()) { setError('Nome da sequência é obrigatório'); return }
    if (steps.some(s => !s.body.trim())) { setError('Todos os passos precisam de uma mensagem'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/whatsapp/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), trigger_event: 'manual', steps }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao criar sequência'); return }
    onCreated(data.sequence)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Nova Sequência de Follow-up</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Nome da sequência *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Follow-up 7 dias"
              autoFocus
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-green-500 transition placeholder-slate-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-xs font-medium">Passos ({steps.length})</p>
              <button
                onClick={addStep}
                className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar passo
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-slate-500 text-xs">Enviar após</span>
                      <input
                        type="number"
                        min={1}
                        value={step.delay_hours}
                        onChange={e => updateStep(i, 'delay_hours', Number(e.target.value))}
                        className="w-16 bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-green-500 text-center"
                      />
                      <span className="text-slate-500 text-xs">horas do passo anterior</span>
                    </div>
                    <button
                      onClick={() => removeStep(i)}
                      disabled={steps.length <= 1}
                      className="text-slate-600 hover:text-red-400 disabled:opacity-30 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    value={step.body}
                    onChange={e => updateStep(i, 'body', e.target.value)}
                    rows={2}
                    placeholder="Mensagem deste passo... Use {nome} para o nome do contato"
                    className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-green-500 transition placeholder-slate-500 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 text-sm bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
            >
              {saving ? 'Salvando...' : 'Criar sequência'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Iniciar Follow-up ──────────────────────────────────────────────────

function EnrollModal({
  contact,
  sequences,
  onClose,
  onEnrolled,
}: {
  contact: Contact
  sequences: Sequence[]
  onClose: () => void
  onEnrolled: () => void
}) {
  const [selectedSeqId, setSelectedSeqId] = useState(sequences[0]?.id ?? '')
  const [enrolling, setEnrolling] = useState(false)
  const [done, setDone] = useState(false)

  async function enroll() {
    if (!selectedSeqId) return
    setEnrolling(true)
    await fetch(`/api/whatsapp/sequences/${selectedSeqId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id }),
    })
    setEnrolling(false)
    setDone(true)
    setTimeout(() => { onEnrolled(); onClose() }, 1000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="text-white font-semibold mb-1">Iniciar Follow-up</h3>
        <p className="text-slate-400 text-sm mb-4">{contact.name || contact.phone}</p>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-400 text-sm font-medium">Contato adicionado ao follow-up!</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-slate-400 text-xs mb-1.5 block">Sequência</label>
              <select
                value={selectedSeqId}
                onChange={e => setSelectedSeqId(e.target.value)}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-green-500 transition"
              >
                {sequences.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sequence_steps?.length ?? 0} passos)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg transition hover:text-white">
                Cancelar
              </button>
              <button
                onClick={enroll}
                disabled={enrolling || !selectedSeqId}
                className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
              >
                {enrolling ? 'Iniciando...' : 'Iniciar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── FollowUpManager (componente principal) ───────────────────────────────────

export function FollowUpManager() {
  const [activeTab, setActiveTab] = useState<'contatos' | 'sequencias' | 'ativos'>('contatos')
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewSeq, setShowNewSeq] = useState(false)
  const [enrollContact, setEnrollContact] = useState<Contact | null>(null)
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null)
  const [deletingSeq, setDeletingSeq] = useState<string | null>(null)

  const FOLLOWUP_THRESHOLD_MS = 48 * 3600 * 1000

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [seqRes, contactsRes, enrollRes] = await Promise.all([
      fetch('/api/whatsapp/sequences'),
      fetch('/api/whatsapp/contacts'),
      fetch('/api/whatsapp/sequences/enrollments'),
    ])
    const seqData = await seqRes.json()
    const contactsData = await contactsRes.json()
    const enrollData = await enrollRes.json()

    setSequences(seqData.sequences ?? [])
    setEnrollments(enrollData.enrollments ?? [])

    const allContacts: Contact[] = contactsData.contacts ?? contactsData ?? []
    const followup = allContacts.filter(c => {
      if (!c.last_message_at) return false
      const age = Date.now() - new Date(c.last_message_at).getTime()
      return age > FOLLOWUP_THRESHOLD_MS && c.unread_count === 0
    })
    setContacts(followup)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function deleteSequence(id: string) {
    setDeletingSeq(id)
    await fetch(`/api/whatsapp/sequences?id=${id}`, { method: 'DELETE' })
    setSequences(prev => prev.filter(s => s.id !== id))
    setDeletingSeq(null)
  }

  const activeEnrollments = enrollments.filter(e => e.status === 'active')
  const completedEnrollments = enrollments.filter(e => e.status === 'completed')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Follow-up Automático</h2>
          <p className="text-slate-500 text-sm mt-0.5">Sequências de contato para clientes sem resposta</p>
        </div>
        <button
          onClick={() => setShowNewSeq(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova sequência
        </button>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {([
          { key: 'contatos',  label: `Precisam de Follow-up (${contacts.length})` },
          { key: 'sequencias', label: `Sequências (${sequences.length})` },
          { key: 'ativos',    label: `Ativos (${activeEnrollments.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          {/* ── Tab: Contatos ── */}
          {activeTab === 'contatos' && (
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Nenhum contato pendente</p>
                  <p className="text-slate-600 text-sm mt-1">Todos os contatos responderam nas últimas 48h</p>
                </div>
              ) : (
                contacts.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 bg-[#111827] border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {(c.name || c.phone).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{c.name || c.phone}</p>
                      <p className="text-slate-500 text-xs">
                        Sem resposta há {formatRelative(c.last_message_at)} · {c.instance_name}
                      </p>
                    </div>
                    <button
                      onClick={() => setEnrollContact(c)}
                      disabled={sequences.length === 0}
                      title={sequences.length === 0 ? 'Crie uma sequência primeiro' : 'Iniciar follow-up'}
                      className="text-xs bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-600/40 hover:border-green-500 px-3 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed font-medium flex-shrink-0"
                    >
                      Iniciar Follow-up
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tab: Sequências ── */}
          {activeTab === 'sequencias' && (
            <div className="space-y-3">
              {sequences.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Nenhuma sequência criada</p>
                  <p className="text-slate-600 text-sm mt-1">Crie sua primeira sequência de follow-up</p>
                  <button
                    onClick={() => setShowNewSeq(true)}
                    className="mt-4 bg-green-600 hover:bg-green-500 text-white text-sm px-5 py-2.5 rounded-lg transition"
                  >
                    Criar sequência
                  </button>
                </div>
              ) : (
                sequences.map(seq => (
                  <div key={seq.id} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{seq.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {seq.sequence_steps?.length ?? 0} passos · Acionamento manual
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedSeq(expandedSeq === seq.id ? null : seq.id)}
                          className="text-slate-500 hover:text-white transition text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
                        >
                          {expandedSeq === seq.id ? 'Fechar' : 'Ver passos'}
                        </button>
                        <button
                          onClick={() => deleteSequence(seq.id)}
                          disabled={deletingSeq === seq.id}
                          className="text-slate-600 hover:text-red-400 transition disabled:opacity-40"
                          title="Excluir sequência"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {expandedSeq === seq.id && (
                      <div className="border-t border-slate-800 px-4 py-3 space-y-2">
                        {(seq.sequence_steps ?? [])
                          .sort((a, b) => a.position - b.position)
                          .map((step, i) => (
                            <div key={i} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                                  {i + 1}
                                </div>
                                {i < (seq.sequence_steps?.length ?? 0) - 1 && (
                                  <div className="w-px flex-1 bg-slate-800 my-1" />
                                )}
                              </div>
                              <div className="pb-2 flex-1 min-w-0">
                                <p className="text-slate-400 text-[10px] mb-0.5">+{step.delay_hours}h</p>
                                <p className="text-slate-300 text-xs leading-relaxed">{step.body}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tab: Ativos ── */}
          {activeTab === 'ativos' && (
            <div className="space-y-2">
              {enrollments.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <p className="text-slate-400 font-medium">Nenhum follow-up ativo</p>
                  <p className="text-slate-600 text-sm mt-1">Inicie um follow-up na aba "Precisam de Follow-up"</p>
                </div>
              ) : (
                enrollments.map(e => (
                  <div
                    key={e.id}
                    className="flex items-center gap-4 bg-[#111827] border border-slate-800 rounded-xl px-4 py-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {(e.whatsapp_contacts?.name || e.whatsapp_contacts?.phone || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {e.whatsapp_contacts?.name || e.whatsapp_contacts?.phone || 'Contato desconhecido'}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {e.sequences?.name} · Passo {e.current_step + 1}
                        {e.next_send_at && ` · Próximo: ${formatRelative(e.next_send_at)}`}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[e.status] ?? 'bg-slate-700 text-slate-400'}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {showNewSeq && (
        <NewSequenceModal
          onClose={() => setShowNewSeq(false)}
          onCreated={seq => setSequences(prev => [seq, ...prev])}
        />
      )}
      {enrollContact && (
        <EnrollModal
          contact={enrollContact}
          sequences={sequences}
          onClose={() => setEnrollContact(null)}
          onEnrolled={() => { loadAll() }}
        />
      )}
    </div>
  )
}
