'use client'

import { useState, useEffect } from 'react'

type Instance = {
  id: string
  instance_name: string
  label: string
  status: 'connected' | 'disconnected'
  created_at: string
}

type DayConfig = {
  enabled: boolean
  open_time: string
  close_time: string
}

type BusinessHours = {
  [key: string]: DayConfig
}

const DAYS = [
  { key: 'sun', label: 'Dom' },
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
]

function defaultBusinessHours(): BusinessHours {
  const result: BusinessHours = {}
  for (const d of DAYS) {
    result[d.key] = { enabled: d.key !== 'sun' && d.key !== 'sat', open_time: '09:00', close_time: '18:00' }
  }
  return result
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
  )
}

function InstanceCard({ instance, onDelete, initialQr }: { instance: Instance; onDelete: () => void; initialQr?: string | null }) {
  const [qr, setQr] = useState<string | null>(initialQr || null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [status, setStatus] = useState(instance.status)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Horário de funcionamento
  const [showBusinessHours, setShowBusinessHours] = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours())
  const [awayMessage, setAwayMessage] = useState('')
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  // Widget
  const [showWidget, setShowWidget] = useState(false)
  const [widgetCopied, setWidgetCopied] = useState(false)

  const widgetCode = `<script src="https://dashboard.viniciusguilherme.shop/api/widget/${instance.instance_name}"></script>`

  async function fetchQr() {
    setLoadingQr(true)
    setQrError(null)
    setQr(null)

    try {
      // Polling por até 60 segundos — QR chega via webhook e é salvo no Supabase
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const res = await fetch(`/api/whatsapp/instance/${instance.instance_name}/qr`)
        if (!res.ok) continue
        const data = await res.json()
        if (data?.base64) {
          setQr(data.base64)
          return
        }
      }
      setQrError('QR não chegou em 60s. Tente novamente ou verifique os logs da Evolution API.')
    } catch {
      setQrError('Erro de conexão ao buscar QR. Tente novamente.')
    } finally {
      setLoadingQr(false)
    }
  }

  async function checkStatus() {
    const res = await fetch(`/api/whatsapp/instance/${instance.instance_name}`)
    const data = await res.json()
    const s = data.instance?.state === 'open' ? 'connected' : 'disconnected'
    setStatus(s)
    if (s === 'connected') setQr(null)
  }

  async function handleDisconnect() {
    await fetch(`/api/whatsapp/instance/${instance.instance_name}?action=logout`, { method: 'DELETE' })
    setStatus('disconnected')
    setQr(null)
  }

  async function syncGroups() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await fetch(`/api/whatsapp/instance/${instance.instance_name}/sync-groups`, { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    setSyncMsg(data.error ? `Erro: ${data.error}` : `${data.groups ?? 0} grupos sincronizados`)
    setTimeout(() => setSyncMsg(null), 4000)
  }

  async function handleDelete() {
    if (!confirm(`Excluir instância "${instance.label}"?`)) return
    await fetch(`/api/whatsapp/instance/${instance.instance_name}`, { method: 'DELETE' })
    onDelete()
  }

  async function saveBusinessHours() {
    setSavingHours(true)
    try {
      await fetch(`/api/whatsapp/instance/${instance.instance_name}/business-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: businessHours }),
      })
      if (awayMessage.trim()) {
        await fetch(`/api/whatsapp/instance/${instance.instance_name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ away_message: awayMessage }),
        })
      }
      setHoursSaved(true)
      setTimeout(() => setHoursSaved(false), 3000)
    } catch {
      // silencioso; pode adicionar setError se quiser
    } finally {
      setSavingHours(false)
    }
  }

  function copyWidget() {
    navigator.clipboard.writeText(widgetCode).then(() => {
      setWidgetCopied(true)
      setTimeout(() => setWidgetCopied(false), 2500)
    })
  }

  function toggleDay(key: string) {
    setBusinessHours(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  function setDayTime(key: string, field: 'open_time' | 'close_time', value: string) {
    setBusinessHours(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  useEffect(() => {
    if (status === 'disconnected') return
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header do card */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <div>
            <p className="text-white font-medium text-sm">{instance.label}</p>
            <p className="text-slate-500 text-xs">{instance.instance_name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={checkStatus} className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded border border-slate-700">
            Verificar
          </button>
          {status === 'connected' && (
            <button onClick={handleDisconnect} className="text-xs text-yellow-400 hover:text-yellow-300 transition px-2 py-1 rounded border border-yellow-800">
              Desconectar
            </button>
          )}
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1 rounded border border-red-900">
            Excluir
          </button>
        </div>
      </div>

      {status === 'disconnected' && (
        <div className="mt-3">
          {qr ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-slate-400 text-xs">Escaneie com o WhatsApp</p>
              <div className="bg-white p-2 rounded-lg inline-block">
                <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code" className="w-40 h-40" />
              </div>
              <button onClick={checkStatus} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">
                Já escaneei, verificar conexão
              </button>
              <button onClick={fetchQr} className="text-xs text-slate-500 hover:text-slate-300 mt-1">
                Atualizar QR
              </button>
            </div>
          ) : qrError ? (
            <div className="text-xs text-red-400 bg-red-900/20 rounded p-2 break-all">
              <p className="font-medium mb-1">Resposta da API:</p>
              <p>{qrError}</p>
              <button onClick={fetchQr} className="mt-2 text-indigo-400 hover:text-indigo-300">Tentar novamente</button>
            </div>
          ) : (
            <button
              onClick={fetchQr}
              disabled={loadingQr}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition font-medium"
            >
              {loadingQr ? 'Carregando QR...' : 'Conectar WhatsApp'}
            </button>
          )}
        </div>
      )}

      {status === 'connected' && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-green-400 text-xs">
            <span>WhatsApp conectado</span>
          </div>
          <button
            onClick={syncGroups}
            disabled={syncing}
            className="w-full text-xs text-indigo-400 hover:text-white border border-indigo-800 hover:bg-indigo-800 disabled:opacity-40 py-1.5 rounded-lg transition"
          >
            {syncing ? 'Sincronizando grupos...' : 'Sincronizar Grupos'}
          </button>
          {syncMsg && (
            <p className={`text-xs text-center ${syncMsg.startsWith('Erro') ? 'text-red-400' : 'text-green-400'}`}>
              {syncMsg}
            </p>
          )}
        </div>
      )}

      {/* Botões de configuração extras */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <button
          onClick={() => { setShowBusinessHours(v => !v); setShowWidget(false) }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
            showBusinessHours
              ? 'bg-slate-700 text-white border-slate-600'
              : 'text-slate-400 hover:text-white border-slate-700 hover:border-slate-500'
          }`}
        >
          {showBusinessHours ? '▲ Horário' : '⏰ Configurar Horário'}
        </button>
        <button
          onClick={() => { setShowWidget(v => !v); setShowBusinessHours(false) }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
            showWidget
              ? 'bg-slate-700 text-white border-slate-600'
              : 'text-slate-400 hover:text-white border-slate-700 hover:border-slate-500'
          }`}
        >
          {showWidget ? '▲ Widget' : '🌐 Widget para site'}
        </button>
      </div>

      {/* Seção: Horário de funcionamento */}
      {showBusinessHours && (
        <div className="mt-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
          <p className="text-white text-xs font-semibold mb-3">Horário de funcionamento</p>
          <div className="space-y-2">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <button
                  onClick={() => toggleDay(key)}
                  className={`w-16 text-xs text-center py-1 rounded font-medium border transition flex-shrink-0 ${
                    businessHours[key].enabled
                      ? 'bg-indigo-700 border-indigo-600 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400'
                  }`}
                >
                  {label}
                </button>
                {businessHours[key].enabled ? (
                  <>
                    <input
                      type="time"
                      value={businessHours[key].open_time}
                      onChange={e => setDayTime(key, 'open_time', e.target.value)}
                      className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 transition"
                    />
                    <span className="text-slate-500 text-xs">até</span>
                    <input
                      type="time"
                      value={businessHours[key].close_time}
                      onChange={e => setDayTime(key, 'close_time', e.target.value)}
                      className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 transition"
                    />
                  </>
                ) : (
                  <span className="text-slate-600 text-xs">Fechado</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="text-slate-400 text-xs block mb-1">Mensagem de ausência</label>
            <textarea
              value={awayMessage}
              onChange={e => setAwayMessage(e.target.value)}
              placeholder="Ex: Estamos fora do horário. Retornaremos em breve!"
              rows={2}
              className="w-full bg-slate-700 text-white text-xs rounded-lg px-3 py-2 outline-none border border-slate-600 focus:border-indigo-500 transition resize-none placeholder-slate-500"
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveBusinessHours}
              disabled={savingHours}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs py-2 rounded-lg transition font-medium"
            >
              {savingHours ? 'Salvando...' : 'Salvar horários'}
            </button>
            {hoursSaved && (
              <span className="text-green-400 text-xs">Salvo!</span>
            )}
          </div>
        </div>
      )}

      {/* Seção: Widget para site */}
      {showWidget && (
        <div className="mt-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
          <p className="text-white text-xs font-semibold mb-1">Widget de WhatsApp para o site</p>
          <p className="text-slate-400 text-xs mb-3">
            Adicione o código abaixo antes do fechamento do <code className="bg-slate-700 px-1 rounded text-slate-300">&lt;/body&gt;</code> no seu site.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-300 text-xs rounded-lg p-3 overflow-x-auto border border-slate-700 leading-relaxed whitespace-pre-wrap break-all">
              {widgetCode}
            </pre>
            <button
              onClick={copyWidget}
              className={`mt-2 w-full text-xs py-2 rounded-lg border transition font-medium ${
                widgetCopied
                  ? 'bg-green-800 border-green-700 text-green-300'
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 hover:text-white'
              }`}
            >
              {widgetCopied ? '✓ Código copiado!' : 'Copiar código'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function InstanceManager() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pendingQr, setPendingQr] = useState<{ instanceName: string; qr: string } | null>(null)

  async function load() {
    const res = await fetch('/api/whatsapp/instance')
    const data = await res.json()
    setInstances(data.instances ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/whatsapp/instance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, label: newName }),
    })
    const data = await res.json()
    setNewName('')
    setShowForm(false)
    setCreating(false)
    await load()
    // Se já veio QR na criação, define no card correto via estado global temporário
    if (data.qrBase64) {
      setPendingQr({ instanceName: data.instanceName, qr: data.qrBase64 })
    }
  }

  if (loading) return <p className="text-slate-400 text-sm">Carregando instâncias...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Instâncias WhatsApp</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition"
        >
          + Nova Instância
        </button>
      </div>

      {showForm && (
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded-xl p-4 flex gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome da instância (ex: cliente-joao)"
            className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
            onKeyDown={e => { if (e.key === 'Enter') create() }}
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition"
          >
            {creating ? 'Criando...' : 'Criar'}
          </button>
        </div>
      )}

      {instances.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-slate-700 rounded-xl">
          Nenhuma instância criada. Crie uma para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map(inst => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onDelete={load}
              initialQr={pendingQr?.instanceName === inst.instance_name ? pendingQr.qr : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
