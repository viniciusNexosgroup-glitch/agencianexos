'use client'

import { useState, useEffect } from 'react'

type BroadcastStatus = 'draft' | 'running' | 'paused' | 'done' | 'error'

interface Campaign {
  id: string
  name: string
  instance_name: string
  status: BroadcastStatus
  total_recipients: number
  sent: number
  delivered: number
  read: number
  replied: number
  created_at: string
}

interface Instance {
  instance_name: string
  status: string
}

interface Tag {
  id: string
  name: string
  contact_count?: number
}

const STATUS_BADGE: Record<BroadcastStatus, string> = {
  draft: 'bg-slate-700 text-slate-300',
  running: 'bg-blue-600 text-white',
  paused: 'bg-yellow-600 text-white',
  done: 'bg-green-700 text-white',
  error: 'bg-red-700 text-white',
}

const STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: 'Rascunho',
  running: 'Enviando',
  paused: 'Pausado',
  done: 'Concluído',
  error: 'Erro',
}

export function BroadcastManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    instance_name: '',
    message: '',
    tag_ids: [] as string[],
  })

  const [estimatedReach, setEstimatedReach] = useState<number | null>(null)

  useEffect(() => {
    fetchCampaigns()
    fetchInstances()
    fetchTags()
  }, [])

  useEffect(() => {
    if (form.tag_ids.length === 0) {
      setEstimatedReach(null)
      return
    }
    const selected = tags.filter(t => form.tag_ids.includes(t.id))
    const total = selected.reduce((acc, t) => acc + (t.contact_count ?? 0), 0)
    setEstimatedReach(total)
  }, [form.tag_ids, tags])

  async function fetchCampaigns() {
    setLoadingCampaigns(true)
    try {
      const res = await fetch('/api/whatsapp/broadcast')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns ?? data ?? [])
      }
    } finally {
      setLoadingCampaigns(false)
    }
  }

  async function fetchInstances() {
    try {
      const res = await fetch('/api/whatsapp/instance')
      if (res.ok) {
        const data = await res.json()
        setInstances(data.instances ?? data ?? [])
      }
    } catch {}
  }

  async function fetchTags() {
    try {
      const res = await fetch('/api/whatsapp/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags ?? data ?? [])
      }
    } catch {}
  }

  async function handleStart(id: string) {
    setStartingId(id)
    try {
      await fetch(`/api/whatsapp/broadcast/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      await fetchCampaigns()
    } finally {
      setStartingId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm({ name: '', instance_name: '', message: '', tag_ids: [] })
        setShowForm(false)
        await fetchCampaigns()
      }
    } finally {
      setSubmitting(false)
    }
  }

  function toggleTag(id: string) {
    setForm(f => ({
      ...f,
      tag_ids: f.tag_ids.includes(id)
        ? f.tag_ids.filter(t => t !== id)
        : [...f.tag_ids, id],
    }))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Broadcast</h2>
          <p className="text-slate-400 text-sm mt-0.5">Envie mensagens em massa para seus contatos</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition"
        >
          {showForm ? 'Cancelar' : '+ Nova Campanha'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-5">Criar nova campanha</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome da campanha</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                  placeholder="Ex: Promoção de abril"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Instância</label>
                <select
                  required
                  value={form.instance_name}
                  onChange={e => setForm(f => ({ ...f, instance_name: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                >
                  <option value="">Selecione uma instância</option>
                  {instances.map(i => (
                    <option key={i.instance_name} value={i.instance_name}>
                      {i.instance_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Texto da mensagem</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
                placeholder="Digite a mensagem que será enviada..."
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Filtrar por tags</label>
              {tags.length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhuma tag disponível</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        form.tag_ids.includes(tag.id)
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {tag.name}
                      {tag.contact_count !== undefined && (
                        <span className="ml-1 opacity-70">({tag.contact_count})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {estimatedReach !== null && (
                <p className="text-green-400 text-sm mt-2">
                  Alcance estimado: <strong>{estimatedReach}</strong> contatos
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {submitting ? 'Criando...' : 'Criar Campanha'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Instância</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Dest.</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Enviadas</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Entregues</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Lidas</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Respondidas</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loadingCampaigns ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-500">
                    Carregando campanhas...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-500">
                    Nenhuma campanha encontrada
                  </td>
                </tr>
              ) : (
                campaigns.map(c => (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-slate-300">{c.instance_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.total_recipients.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.sent.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.delivered.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.read.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.replied.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {c.status === 'draft' && (
                          <button
                            onClick={() => handleStart(c.id)}
                            disabled={startingId === c.id}
                            className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded-lg transition"
                          >
                            {startingId === c.id ? 'Iniciando...' : 'Iniciar'}
                          </button>
                        )}
                        <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition">
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
