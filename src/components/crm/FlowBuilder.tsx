'use client'

import { useState, useEffect } from 'react'

type TriggerType = 'keyword' | 'first_message' | 'manual'
type StepType = 'message' | 'tag' | 'assign' | 'condition'

interface FlowStep {
  id: string
  delay_hours: number
  type: StepType
  message?: string
  tag_name?: string
  agent_id?: string
  condition_keyword?: string
  condition_goto?: number
}

interface Flow {
  id: string
  name: string
  instance_name: string
  trigger_type: TriggerType
  trigger_value: string
  status: 'active' | 'inactive'
  active_executions: number
  steps: FlowStep[]
}

interface Instance {
  instance_name: string
}

interface Agent {
  id: string
  name: string
}

interface Tag {
  id: string
  name: string
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  keyword: 'Palavra-chave',
  first_message: 'Primeira mensagem',
  manual: 'Manual',
}

const STEP_TYPE_LABELS: Record<StepType, string> = {
  message: 'Enviar mensagem',
  tag: 'Adicionar tag',
  assign: 'Atribuir agente',
  condition: 'Condição',
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function emptyStep(): FlowStep {
  return { id: uid(), delay_hours: 0, type: 'message', message: '' }
}

export function FlowBuilder() {
  const [flows, setFlows] = useState<Flow[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowInstance, setNewFlowInstance] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchFlows()
    fetchInstances()
    fetchAgents()
    fetchTags()
  }, [])

  async function fetchFlows() {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/flows')
      if (res.ok) {
        const d = await res.json()
        const raw: Flow[] = d.flows ?? d ?? []
        setFlows(raw.map(f => ({
          ...f,
          steps: f.steps ?? [],
          status: f.status ?? ((f as any).is_active ? 'active' : 'inactive'),
          active_executions: f.active_executions ?? 0,
          trigger_type: f.trigger_type ?? 'keyword',
          trigger_value: f.trigger_value ?? '',
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchInstances() {
    try {
      const res = await fetch('/api/whatsapp/instance')
      if (res.ok) {
        const d = await res.json()
        setInstances(d.instances ?? d ?? [])
      }
    } catch {}
  }

  async function fetchAgents() {
    try {
      const res = await fetch('/api/whatsapp/agents')
      if (res.ok) {
        const d = await res.json()
        setAgents(d.agents ?? d ?? [])
      }
    } catch {}
  }

  async function fetchTags() {
    try {
      const res = await fetch('/api/whatsapp/tags')
      if (res.ok) {
        const d = await res.json()
        setTags(d.tags ?? d ?? [])
      }
    } catch {}
  }

  async function handleToggle(flow: Flow) {
    setTogglingId(flow.id)
    setToggleError(null)
    try {
      const res = await fetch(`/api/whatsapp/flows/${flow.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' }),
      })
      const d = await res.json()
      if (res.ok) {
        const newStatus = d.flow?.is_active ? 'active' : 'inactive'
        setFlows(fs => fs.map(f => f.id === flow.id ? { ...f, status: newStatus } : f))
      } else {
        setToggleError(d.error ?? `Erro ao alterar status (${res.status})`)
      }
    } catch (err: any) {
      setToggleError(err.message ?? 'Erro de rede ao alterar status')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/whatsapp/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFlowName,
          instance_name: newFlowInstance,
          trigger_type: 'keyword',
          trigger_value: '',
          status: 'inactive',
          steps: [],
        }),
      })
      if (res.ok) {
        const d = await res.json()
        const raw = d.flow ?? d
        const created: Flow = {
          ...raw,
          steps: raw.steps ?? [],
          status: raw.status ?? (raw.is_active ? 'active' : 'inactive'),
          active_executions: raw.active_executions ?? 0,
          trigger_type: raw.trigger_type ?? 'keyword',
          trigger_value: raw.trigger_value ?? '',
        }
        setFlows(fs => [created, ...fs])
        setNewFlowName('')
        setNewFlowInstance('')
        setShowNewForm(false)
        setEditingFlow(created)
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!editingFlow) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/whatsapp/flows/${editingFlow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFlow),
      })
      const d = await res.json()
      if (res.ok) {
        setFlows(fs => fs.map(f => f.id === editingFlow.id ? editingFlow : f))
      } else {
        setSaveError(d.error ?? `Erro ao salvar (${res.status})`)
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Erro de rede ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function updateStep(index: number, patch: Partial<FlowStep>) {
    if (!editingFlow) return
    const steps = editingFlow.steps.map((s, i) => i === index ? { ...s, ...patch } : s)
    setEditingFlow({ ...editingFlow, steps })
  }

  function removeStep(index: number) {
    if (!editingFlow) return
    setEditingFlow({ ...editingFlow, steps: editingFlow.steps.filter((_, i) => i !== index) })
  }

  function addStep() {
    if (!editingFlow) return
    setEditingFlow({ ...editingFlow, steps: [...editingFlow.steps, emptyStep()] })
  }

  if (editingFlow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingFlow(null)}
            className="text-slate-400 hover:text-white text-sm transition"
          >
            ← Voltar
          </button>
          <h2 className="text-lg font-semibold text-white">{editingFlow.name}</h2>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
          <h3 className="text-white font-medium">Trigger</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tipo de trigger</label>
              <select
                value={editingFlow.trigger_type}
                onChange={e => setEditingFlow({ ...editingFlow, trigger_type: e.target.value as TriggerType })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
                {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {editingFlow.trigger_type === 'keyword' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Palavra-chave</label>
                <input
                  value={editingFlow.trigger_value}
                  onChange={e => setEditingFlow({ ...editingFlow, trigger_value: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                  placeholder="Ex: oi, ajuda, preço..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-medium">Etapas sequenciais</h3>

          {editingFlow.steps.length === 0 && (
            <p className="text-slate-500 text-sm">Nenhuma etapa. Adicione uma abaixo.</p>
          )}

          {editingFlow.steps.map((step, idx) => (
            <div key={step.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  Etapa {idx + 1}
                </span>
                <button
                  onClick={() => removeStep(idx)}
                  className="text-slate-500 hover:text-red-400 text-xs transition"
                >
                  Remover
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                  <select
                    value={step.type}
                    onChange={e => updateStep(idx, { type: e.target.value as StepType })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                  >
                    {(Object.entries(STEP_TYPE_LABELS) as [StepType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Delay (horas)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={step.delay_hours}
                    onChange={e => updateStep(idx, { delay_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              {step.type === 'message' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mensagem</label>
                  <textarea
                    rows={3}
                    value={step.message ?? ''}
                    onChange={e => updateStep(idx, { message: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
                    placeholder="Digite a mensagem..."
                  />
                </div>
              )}

              {step.type === 'tag' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tag</label>
                  <select
                    value={step.tag_name ?? ''}
                    onChange={e => updateStep(idx, { tag_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="">Selecione uma tag</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {step.type === 'assign' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Agente</label>
                  <select
                    value={step.agent_id ?? ''}
                    onChange={e => updateStep(idx, { agent_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="">Selecione um agente</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {step.type === 'condition' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Keyword contém</label>
                    <input
                      value={step.condition_keyword ?? ''}
                      onChange={e => updateStep(idx, { condition_keyword: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                      placeholder="Ex: sim, não..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ir para etapa nº</label>
                    <input
                      type="number"
                      min={1}
                      value={step.condition_goto ?? ''}
                      onChange={e => updateStep(idx, { condition_goto: parseInt(e.target.value) || undefined })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addStep}
            className="w-full py-2.5 border border-dashed border-slate-600 hover:border-green-500 text-slate-400 hover:text-green-400 text-sm rounded-xl transition"
          >
            + Adicionar etapa
          </button>
        </div>

        {saveError && (
          <div className="bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
            <strong>Erro ao salvar:</strong> {saveError}
            {saveError.includes('steps') && (
              <p className="mt-1 text-red-400 text-xs">Execute no Supabase SQL Editor: <code className="bg-slate-800 px-1 rounded">ALTER TABLE flows ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;</code></p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {saving ? 'Salvando...' : 'Salvar flow'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Flows (Chatbot)</h2>
          <p className="text-slate-400 text-sm mt-0.5">Configure automações de chatbot por instância</p>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition"
        >
          {showNewForm ? 'Cancelar' : '+ Novo Flow'}
        </button>
      </div>

      {showNewForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Criar novo flow</h3>
          <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-3">
            <input
              required
              value={newFlowName}
              onChange={e => setNewFlowName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Nome do flow"
            />
            <select
              required
              value={newFlowInstance}
              onChange={e => setNewFlowInstance(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">Selecione uma instância</option>
              {instances.map(i => (
                <option key={i.instance_name} value={i.instance_name}>{i.instance_name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {creating ? 'Criando...' : 'Criar'}
            </button>
          </form>
        </div>
      )}

      {toggleError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center justify-between">
          <span><strong>Erro ao alterar status:</strong> {toggleError}</span>
          <button onClick={() => setToggleError(null)} className="text-red-400 hover:text-red-200 ml-4 text-xs">✕</button>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Instância</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Trigger</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Execuções ativas</th>
                <th className="text-center px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">Carregando flows...</td>
                </tr>
              ) : flows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">Nenhum flow encontrado</td>
                </tr>
              ) : (
                flows.map(flow => (
                  <tr key={flow.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 text-white font-medium">{flow.name}</td>
                    <td className="px-4 py-3 text-slate-300">{flow.instance_name}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="text-slate-400">{TRIGGER_LABELS[flow.trigger_type]}</span>
                      {flow.trigger_value && (
                        <span className="ml-2 text-xs bg-slate-700 rounded px-1.5 py-0.5 text-slate-300">
                          {flow.trigger_value}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{flow.active_executions}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(flow)}
                        disabled={togglingId === flow.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          flow.status === 'active' ? 'bg-green-600' : 'bg-slate-600'
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            flow.status === 'active' ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditingFlow(flow)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition"
                      >
                        Editar
                      </button>
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
