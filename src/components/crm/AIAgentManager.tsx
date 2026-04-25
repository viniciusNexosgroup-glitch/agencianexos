'use client'

import { useState, useEffect } from 'react'

type Instance = { instance_name: string; label: string; status: string }

type AIAgent = {
  id?: string
  instance_name: string
  name: string
  provider: string
  model: string
  system_prompt: string
  is_active: boolean
  handoff_keywords: string[]
  temperature: number
  api_key?: string
}

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
}

const DEFAULT_AGENT: Omit<AIAgent, 'instance_name'> = {
  name: 'Assistente IA',
  provider: 'openai',
  model: 'gpt-4o-mini',
  system_prompt: 'Você é um assistente de vendas. Responda de forma amigável e profissional. Qualifique os leads perguntando sobre suas necessidades e orçamento.',
  is_active: false,
  handoff_keywords: ['humano', 'atendente', 'pessoa real'],
  temperature: 0.7,
  api_key: '',
}

export function AIAgentManager() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [form, setForm] = useState({ ...DEFAULT_AGENT, instance_name: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testReply, setTestReply] = useState('')
  const [testing, setTesting] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    fetch('/api/whatsapp/instance')
      .then(r => r.json())
      .then(d => {
        const list: Instance[] = d.instances ?? []
        setInstances(list)
        if (list.length > 0) setSelectedInstance(list[0].instance_name)
      })
  }, [])

  useEffect(() => {
    if (!selectedInstance) return
    setLoading(true)
    setAgent(null)
    fetch(`/api/whatsapp/ai-agent?instance_name=${selectedInstance}`)
      .then(r => r.json())
      .then(d => {
        if (d.agent) {
          setAgent(d.agent)
          setForm({ ...d.agent })
        } else {
          setForm({ ...DEFAULT_AGENT, instance_name: selectedInstance })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedInstance])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, instance_name: selectedInstance }),
      })
      const data = await res.json()
      if (data.agent) { setAgent(data.agent); setForm(data.agent) }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function testAgent() {
    if (!testMsg.trim() || testing) return
    setTesting(true)
    setTestReply('')
    try {
      const res = await fetch('/api/whatsapp/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: 'test', message: testMsg, instance_name: selectedInstance }),
      })
      const data = await res.json()
      setTestReply(data.reply || data.error || 'Sem resposta')
    } catch {
      setTestReply('Erro ao testar agente.')
    } finally {
      setTesting(false)
    }
  }

  function addKeyword() {
    const kw = keywordInput.trim()
    if (!kw || form.handoff_keywords.includes(kw)) return
    setForm(f => ({ ...f, handoff_keywords: [...f.handoff_keywords, kw] }))
    setKeywordInput('')
  }

  function removeKeyword(kw: string) {
    setForm(f => ({ ...f, handoff_keywords: f.handoff_keywords.filter(k => k !== kw) }))
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg mb-1">Agente de IA</h2>
        <p className="text-slate-400 text-sm">Configure um chatbot inteligente para qualificar leads automaticamente 24h.</p>
      </div>

      {/* Selecionar instância */}
      <div className="mb-6">
        <label className="text-slate-400 text-xs font-medium block mb-1.5">Instância WhatsApp</label>
        <select
          value={selectedInstance}
          onChange={e => setSelectedInstance(e.target.value)}
          className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition"
        >
          {instances.map(i => (
            <option key={i.instance_name} value={i.instance_name}>{i.label || i.instance_name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-slate-400 text-sm">Carregando configuração...</p>}

      {!loading && selectedInstance && (
        <div className="space-y-5">
          {/* Toggle ativo */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Agente IA ativo</p>
              <p className="text-slate-400 text-xs mt-0.5">Quando ativo, responde automaticamente às mensagens recebidas</p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Nome */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Nome do agente</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
                placeholder="Assistente IA"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Provedor</label>
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: MODELS[e.target.value][0] }))}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            {/* API Key */}
            <div className="col-span-2">
              <label className="text-slate-400 text-xs font-medium block mb-1.5">
                Token da API {form.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={form.api_key ?? ''}
                  onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 pr-10 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500 font-mono"
                  placeholder={form.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showApiKey ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Sua chave de API. Os custos de uso serão cobrados diretamente na sua conta {form.provider === 'openai' ? 'OpenAI' : 'Anthropic'}.
              </p>
            </div>

            {/* Modelo */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Modelo</label>
              <select
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition"
              >
                {(MODELS[form.provider] ?? []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Temperatura */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">
                Temperatura: <span className="text-white">{form.temperature.toFixed(1)}</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.1"
                value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Preciso</span><span>Criativo</span>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              rows={6}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500 resize-none"
              placeholder="Você é um assistente de vendas..."
            />
            <p className="text-slate-500 text-xs mt-1">Instrua o agente sobre como responder, tom de voz e o que fazer.</p>
          </div>

          {/* Palavras-chave de handoff */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Palavras-chave para transferir ao humano</label>
            <div className="flex gap-2 mb-2">
              <input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                placeholder="ex: humano, atendente..."
                className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
              />
              <button
                onClick={addKeyword}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.handoff_keywords.map(kw => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-full">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-red-400 transition">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Salvar */}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar configuração'}
          </button>

          {/* Teste rápido */}
          <div className="border-t border-slate-700 pt-5">
            <h3 className="text-white text-sm font-medium mb-3">Teste rápido</h3>
            <div className="flex gap-2 mb-3">
              <input
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && testAgent()}
                placeholder="Simule uma mensagem do cliente..."
                className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
              />
              <button
                onClick={testAgent}
                disabled={testing || !testMsg.trim() || !agent?.is_active}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition"
              >
                {testing ? 'Testando...' : 'Testar'}
              </button>
            </div>
            {!agent?.is_active && (
              <p className="text-yellow-400 text-xs">Ative o agente para testar.</p>
            )}
            {testReply && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-xs font-medium mb-1">Resposta do agente:</p>
                <p className="text-white text-sm whitespace-pre-wrap">{testReply}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
