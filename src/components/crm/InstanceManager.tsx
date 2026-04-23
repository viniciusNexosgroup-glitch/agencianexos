'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

type Instance = {
  id: string
  instance_name: string
  label: string
  status: 'connected' | 'disconnected'
  created_at: string
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

  useEffect(() => {
    if (status === 'disconnected') return
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <div>
            <p className="text-white font-medium text-sm">{instance.label}</p>
            <p className="text-slate-500 text-xs">{instance.instance_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
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
