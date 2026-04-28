'use client'

import { useState, useEffect } from 'react'

type Instance = {
  id: string
  instance_name: string
  label: string
  status: 'connected' | 'disconnected'
  created_at: string
  provider?: 'baileys' | 'cloud_api' | null
  phone_number_id?: string | null
  waba_id?: string | null
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
      // Primeira tentativa imediata
      for (let i = 0; i < 15; i++) {
        const res = await fetch(`/api/whatsapp/instance/${instance.instance_name}/qr`)
        if (res.ok) {
          const data = await res.json()
          if (data?.connected) {
            setStatus('connected')
            setLoadingQr(false)
            return
          }
          if (data?.base64) {
            setQr(data.base64)
            setLoadingQr(false)
            return
          }
        }
        // Aguarda 3s antes da próxima tentativa
        if (i < 14) await new Promise(r => setTimeout(r, 3000))
      }
      setQrError('QR não chegou em 45s. Verifique se a Evolution API está acessível e tente novamente.')
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

  async function reconfigureWebhook() {
    const res = await fetch(`/api/whatsapp/instance/${instance.instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_webhook' }),
    })
    if (res.ok) {
      alert('Webhook reconfigurado com sucesso!')
    } else {
      const d = await res.json()
      alert('Erro: ' + (d.error ?? 'falha ao configurar webhook'))
    }
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
          <button onClick={reconfigureWebhook} className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded border border-blue-800">
            Configurar Webhook
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

      {/* Cloud API: não tem QR, conexão é via token */}
      {instance.provider === 'cloud_api' && (
        <div className="mt-3 bg-blue-950/40 border border-blue-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span className="text-blue-300 text-xs font-medium">API Oficial do WhatsApp (Cloud API)</span>
          </div>
          {instance.phone_number_id && (
            <p className="text-slate-400 text-xs">Phone Number ID: <span className="text-slate-300 font-mono">{instance.phone_number_id}</span></p>
          )}
          {instance.waba_id && (
            <p className="text-slate-400 text-xs mt-0.5">WABA ID: <span className="text-slate-300 font-mono">{instance.waba_id}</span></p>
          )}
          <p className="text-slate-500 text-[10px] mt-2">Configure o webhook no Meta Business Manager apontando para sua instância Evolution API.</p>
        </div>
      )}

      {/* Baileys: QR code */}
      {instance.provider !== 'cloud_api' && status === 'disconnected' && (
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
  const [showForm, setShowForm] = useState(false)
  const [pendingQr, setPendingQr] = useState<{ instanceName: string; qr: string } | null>(null)

  // Campos do formulário
  const [formProvider, setFormProvider] = useState<'baileys' | 'cloud_api'>('baileys')
  const [formName, setFormName] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formPhoneId, setFormPhoneId] = useState('')
  const [formWabaId, setFormWabaId] = useState('')
  const [formError, setFormError] = useState('')

  async function load() {
    const res = await fetch('/api/whatsapp/instance')
    const data = await res.json()
    setInstances(data.instances ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setFormName('')
    setFormToken('')
    setFormPhoneId('')
    setFormWabaId('')
    setFormError('')
    setShowForm(false)
  }

  async function create() {
    if (!formName.trim()) return
    if (formProvider === 'cloud_api' && (!formToken.trim() || !formPhoneId.trim())) {
      setFormError('Token de Acesso e Phone Number ID são obrigatórios.')
      return
    }
    setCreating(true)
    setFormError('')
    const body: Record<string, string> = { name: formName, label: formName, provider: formProvider }
    if (formProvider === 'cloud_api') {
      body.token = formToken
      body.phoneNumberId = formPhoneId
      if (formWabaId.trim()) body.wabaId = formWabaId
    }
    const res = await fetch('/api/whatsapp/instance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) {
      setFormError(data.error)
      setCreating(false)
      return
    }
    resetForm()
    setCreating(false)
    await load()
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
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
          {/* Seleção de provedor */}
          <div className="flex gap-2">
            <button
              onClick={() => setFormProvider('baileys')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                formProvider === 'baileys'
                  ? 'bg-green-700 border-green-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Web (QR Code)
            </button>
            <button
              onClick={() => setFormProvider('cloud_api')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                formProvider === 'cloud_api'
                  ? 'bg-blue-700 border-blue-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              API Oficial (Business)
            </button>
          </div>

          {/* Nome da instância */}
          <input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Nome da instância (ex: minha-empresa)"
            className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-indigo-500 transition placeholder-slate-500"
            onKeyDown={e => { if (e.key === 'Enter' && formProvider === 'baileys') create() }}
          />

          {/* Campos específicos da API Oficial */}
          {formProvider === 'cloud_api' && (
            <div className="space-y-2 p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg">
              <p className="text-blue-300 text-xs font-medium mb-2">Credenciais do Meta Business</p>
              <input
                value={formToken}
                onChange={e => setFormToken(e.target.value)}
                placeholder="Token de Acesso Permanente *"
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-blue-500 transition placeholder-slate-500"
              />
              <input
                value={formPhoneId}
                onChange={e => setFormPhoneId(e.target.value)}
                placeholder="Phone Number ID *"
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-blue-500 transition placeholder-slate-500"
              />
              <input
                value={formWabaId}
                onChange={e => setFormWabaId(e.target.value)}
                placeholder="WhatsApp Business Account ID (opcional)"
                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-blue-500 transition placeholder-slate-500"
              />
              <p className="text-slate-500 text-[10px]">Encontre esses dados em: Meta Business Suite → WhatsApp Manager → Configurações da API</p>
            </div>
          )}

          {formError && <p className="text-red-400 text-xs">{formError}</p>}

          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-sm transition"
            >
              Cancelar
            </button>
            <button
              onClick={create}
              disabled={creating || !formName.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition font-medium"
            >
              {creating ? 'Criando...' : 'Criar Instância'}
            </button>
          </div>
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
