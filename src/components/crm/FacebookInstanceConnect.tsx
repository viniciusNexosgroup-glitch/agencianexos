'use client'

import { useState, useEffect } from 'react'

interface Phone {
  wabaId: string
  wabaName: string
  phoneNumberId: string
  displayNumber: string
  verifiedName: string
}

interface Props {
  onCreated: () => void
  onCancel: () => void
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || ''

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

export function FacebookInstanceConnect({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState<'login' | 'phones' | 'naming' | 'creating'>('login')
  const [phones, setPhones] = useState<Phone[]>([])
  const [selected, setSelected] = useState<Phone | null>(null)
  const [instanceName, setInstanceName] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState('')
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    if (!APP_ID) return
    if (window.FB) { setSdkReady(true); return }

    window.fbAsyncInit = function () {
      window.FB.init({ appId: APP_ID, version: 'v19.0', xfbml: false, cookie: true })
      setSdkReady(true)
    }

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  function loginWithFacebook() {
    if (!window.FB) { setError('SDK do Facebook não carregou. Recarregue a página.'); return }
    setError('')
    window.FB.login(async (response: any) => {
      if (!response.authResponse?.accessToken) {
        setError('Login cancelado ou negado.')
        return
      }
      const token = response.authResponse.accessToken
      setAccessToken(token)
      setStep('phones')

      const res = await fetch('/api/whatsapp/facebook-phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('login'); return }
      if (data.phones.length === 0) {
        setError('Nenhum número encontrado nessa conta. Verifique se tem uma conta WhatsApp Business ativa.')
        setStep('login')
        return
      }
      setPhones(data.phones)
      if (data.phones.length === 1) {
        setSelected(data.phones[0])
        setInstanceName(data.phones[0].verifiedName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30))
        setStep('naming')
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
    })
  }

  function selectPhone(phone: Phone) {
    setSelected(phone)
    setInstanceName(phone.verifiedName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30))
    setStep('naming')
  }

  async function createInstance() {
    if (!selected || !instanceName.trim()) return
    setStep('creating')
    setError('')

    const res = await fetch('/api/whatsapp/instance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: instanceName.trim(),
        label: selected.verifiedName || selected.displayNumber,
        provider: 'cloud_api',
        token: accessToken,
        phoneNumberId: selected.phoneNumberId,
        wabaId: selected.wabaId,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Erro ao criar instância.')
      setStep('naming')
      return
    }
    onCreated()
  }

  if (!APP_ID) {
    return (
      <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-xl text-amber-300 text-sm">
        <p className="font-medium mb-1">Configuração necessária</p>
        <p>Adicione <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_META_APP_ID</code> no arquivo <code className="bg-black/30 px-1 rounded">.env.local</code> com o ID do seu app Meta.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {step === 'login' && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Conecte sua conta do Facebook para importar automaticamente os números do WhatsApp Business.</p>
          <button
            onClick={loginWithFacebook}
            disabled={!sdkReady}
            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            {sdkReady ? 'Conectar com Facebook' : 'Carregando...'}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      )}

      {step === 'phones' && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Buscando números da sua conta...</p>
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {step === 'naming' && selected && (
        <div className="space-y-4">
          {phones.length > 1 && (
            <div className="space-y-2">
              <p className="text-slate-300 text-sm font-medium">Número selecionado:</p>
              <div className="space-y-2">
                {phones.map(p => (
                  <button
                    key={p.phoneNumberId}
                    onClick={() => selectPhone(p)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      selected.phoneNumberId === p.phoneNumberId
                        ? 'border-indigo-500 bg-indigo-900/30 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <p className="font-medium">{p.verifiedName}</p>
                    <p className="text-xs text-slate-400">{p.displayNumber} · {p.wabaName}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phones.length === 1 && (
            <div className="px-4 py-3 rounded-xl border border-emerald-700 bg-emerald-900/20">
              <p className="text-emerald-300 font-medium">{selected.verifiedName}</p>
              <p className="text-xs text-slate-400">{selected.displayNumber}</p>
            </div>
          )}

          <div>
            <label className="text-slate-400 text-xs mb-1 block">Nome da instância (sem espaços)</label>
            <input
              value={instanceName}
              onChange={e => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="minha-empresa"
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={createInstance}
            disabled={!instanceName.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          >
            Conectar
          </button>
        </div>
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Criando instância...</p>
        </div>
      )}

      <button onClick={onCancel} className="w-full text-slate-500 hover:text-slate-300 text-sm transition py-1">
        Cancelar
      </button>
    </div>
  )
}
