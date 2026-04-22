'use client'

import { useState } from 'react'

interface Client { id: string; name: string; email: string; is_admin: boolean; created_at: string }
interface Account { id: string; client_id: string; ad_account_id: string; account_name: string; bm_name: string; is_active: boolean }
interface SyncLog { id: string; ad_account_id: string; status: string; campaigns_synced: number; date_from: string; date_to: string; error_message: string; created_at: string }

interface Props {
  clients: Client[]
  allAccounts: Account[]
  syncLogs: SyncLog[]
}

export function AdminPanel({ clients, allAccounts, syncLogs }: Props) {
  const [tab, setTab] = useState<'clients' | 'sync'>('clients')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviting, setInviting] = useState(false)

  const [accountClientId, setAccountClientId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [bmName, setBmName] = useState('')
  const [accountMsg, setAccountMsg] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  async function inviteClient(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true); setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    })
    const json = await res.json()
    setInviteMsg(json.message || json.error)
    setInviting(false)
    if (res.ok) { setInviteEmail(''); setInviteName('') }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    setAddingAccount(true); setAccountMsg('')
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: accountClientId, ad_account_id: accountId, account_name: accountName, bm_name: bmName }),
    })
    const json = await res.json()
    setAccountMsg(json.message || json.error)
    setAddingAccount(false)
    if (res.ok) { setAccountClientId(''); setAccountId(''); setAccountName(''); setBmName('') }
  }

  async function triggerSync() {
    setSyncing(true); setSyncMsg('')
    const secret = prompt('Digite o SYNC_SECRET:')
    if (!secret) { setSyncing(false); return }
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'x-sync-secret': secret },
    })
    const json = await res.json()
    setSyncMsg(json.message || json.error)
    setSyncing(false)
  }

  const tabs = [
    { id: 'clients', label: 'Clientes & Contas' },
    { id: 'sync', label: 'Sincronização' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Convidar cliente */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Convidar novo cliente</h2>
            <form onSubmit={inviteClient} className="space-y-3">
              <input
                placeholder="Nome do cliente"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="Email do cliente"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={inviting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition"
              >
                {inviting ? 'Enviando...' : 'Enviar convite'}
              </button>
              {inviteMsg && <p className="text-sm text-center text-emerald-400">{inviteMsg}</p>}
            </form>
          </div>

          {/* Vincular conta */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Vincular conta de anúncio</h2>
            <form onSubmit={addAccount} className="space-y-3">
              <select
                value={accountClientId}
                onChange={e => setAccountClientId(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecionar cliente</option>
                {clients.filter(c => !c.is_admin).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
              <input
                placeholder="ID da conta (act_XXXXXXXXXX)"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                placeholder="Nome da conta"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                placeholder="Nome da BM (opcional)"
                value={bmName}
                onChange={e => setBmName(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={addingAccount}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition"
              >
                {addingAccount ? 'Vinculando...' : 'Vincular conta'}
              </button>
              {accountMsg && <p className="text-sm text-center text-emerald-400">{accountMsg}</p>}
            </form>
          </div>

          {/* Lista de clientes */}
          <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Clientes ({clients.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Nome', 'Email', 'Contas vinculadas', 'Desde'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {clients.map(c => {
                    const accs = allAccounts.filter(a => a.client_id === c.id)
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-3 text-white font-medium">
                          {c.name} {c.is_admin && <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded ml-1">admin</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-400">{c.email}</td>
                        <td className="px-3 py-3 text-slate-300">{accs.length} {accs.length > 0 && <span className="text-slate-500 text-xs">({accs.map(a => a.account_name || a.ad_account_id).join(', ')})</span>}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'sync' && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">Sincronização manual</h2>
              <p className="text-slate-400 text-sm mt-1">Puxa métricas dos últimos 30 dias de todas as contas ativas.</p>
            </div>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition"
            >
              {syncing ? 'Sincronizando...' : '🔄 Sincronizar agora'}
            </button>
          </div>
          {syncMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-400 text-sm">{syncMsg}</div>
          )}

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Histórico de sync (últimas 20)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Conta', 'Status', 'Campanhas', 'Período', 'Data'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {syncLogs.map(log => (
                    <tr key={log.id}>
                      <td className="px-3 py-3 text-slate-300 text-xs">{log.ad_account_id}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                          log.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>{log.status}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{log.campaigns_synced}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs">{log.date_from} → {log.date_to}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  {syncLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nenhum sync realizado ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
