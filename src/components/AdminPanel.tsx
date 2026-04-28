'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiscoverAccountsButton } from '@/components/DiscoverAccountsButton'

interface Client { id: string; name: string; email: string; is_admin: boolean; created_at: string }
interface Account { id: string; client_id: string; ad_account_id: string; account_name: string; bm_name: string; is_active: boolean }
interface SyncLog { id: string; ad_account_id: string; status: string; campaigns_synced: number; date_from: string; date_to: string; error_message: string; created_at: string }

interface TableStat { table_name: string; row_count: number; total_size: string; size_bytes: number }
interface RetentionSetting { key: string; value_days: number; description: string; updated_at: string }
interface PreviewCleanup { would_delete: Record<string, number> }

interface Props {
  clients: Client[]
  allAccounts: Account[]
  syncLogs: SyncLog[]
}

const LABEL: Record<string, string> = {
  messages_retention_days:           'Mensagens WhatsApp',
  notifications_read_retention_days: 'Notificações lidas',
  sync_logs_retention_days:          'Logs de sincronização',
  campaign_metrics_retention_days:   'Métricas de campanhas',
  flow_executions_retention_days:    'Execuções de flows',
  broadcast_retention_days:          'Broadcasts finalizados',
  lead_history_retention_days:       'Histórico de etapas',
  enrollments_retention_days:        'Inscrições em sequências',
}

const PREVIEW_LABEL: Record<string, string> = {
  whatsapp_messages:    'Mensagens WhatsApp',
  notifications:        'Notificações',
  sync_logs:            'Logs de sync',
  campaign_metrics:     'Métricas de campanhas',
  flow_executions:      'Execuções de flows',
  broadcast_campaigns:  'Broadcasts',
  lead_stage_history:   'Histórico de etapas',
  sequence_enrollments: 'Inscrições em sequências',
}

const FREE_TIER_MB = 500

function StorageBar({ usedBytes }: { usedBytes: number }) {
  const usedMB = usedBytes / (1024 * 1024)
  const pct = Math.min((usedMB / FREE_TIER_MB) * 100, 100)
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 font-medium">{usedMB.toFixed(1)} MB usados</span>
        <span className="text-slate-500">{FREE_TIER_MB} MB (plano gratuito)</span>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-slate-500 text-xs">{pct.toFixed(1)}% do limite utilizado</p>
    </div>
  )
}

export function AdminPanel({ clients, allAccounts, syncLogs }: Props) {
  const [tab, setTab] = useState<'clients' | 'sync' | 'storage'>('clients')

  // ── Create user form ────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean; sql?: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [showSql, setShowSql] = useState(false)

  // ── Invite / account forms ──────────────────────────────────────────────────
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

  // ── Storage tab state ───────────────────────────────────────────────────────
  const [storageLoading, setStorageLoading] = useState(false)
  const [tableStats, setTableStats] = useState<TableStat[]>([])
  const [preview, setPreview] = useState<PreviewCleanup | null>(null)
  const [settings, setSettings] = useState<RetentionSetting[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<Record<string, number> | null>(null)
  const [storageError, setStorageError] = useState('')

  const loadStorage = useCallback(async () => {
    setStorageLoading(true)
    setStorageError('')
    try {
      const res = await fetch('/api/admin/cleanup')
      if (!res.ok) throw new Error('Falha ao carregar estatísticas')
      const json = await res.json()
      setTableStats(json.stats ?? [])
      setPreview(json.preview ?? null)
      setSettings(json.settings ?? [])
    } catch (e: any) {
      setStorageError(e.message)
    } finally {
      setStorageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'storage') loadStorage()
  }, [tab, loadStorage])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateMsg(null); setShowSql(false)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword }),
    })
    const json = await res.json()
    if (res.ok) {
      setCreateMsg({ text: json.message, ok: true })
      setNewEmail(''); setNewName(''); setNewPassword('')
    } else if (res.status === 422 && json.sql) {
      setCreateMsg({ text: 'Criação automática falhou. Copie o SQL abaixo e execute no Supabase SQL Editor:', ok: false, sql: json.sql })
    } else {
      setCreateMsg({ text: json.error, ok: false })
    }
    setCreating(false)
  }

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

  async function saveSetting(key: string) {
    const days = parseInt(editingValue)
    if (isNaN(days) || days < 0) return
    setSavingKey(key)
    const res = await fetch('/api/admin/cleanup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value_days: days }),
    })
    if (res.ok) {
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value_days: days } : s))
      loadStorage()
    }
    setSavingKey(null)
    setEditingKey(null)
  }

  async function runCleanup() {
    if (!confirm('Tem certeza? Os registros serão apagados permanentemente.')) return
    setCleaning(true)
    setCleanResult(null)
    const res = await fetch('/api/admin/cleanup', { method: 'POST' })
    const json = await res.json()
    if (res.ok && json.result?.deleted) {
      setCleanResult(json.result.deleted)
      loadStorage()
    }
    setCleaning(false)
  }

  const totalBytes = tableStats.reduce((sum, t) => sum + (t.size_bytes || 0), 0)

  const tabs = [
    { id: 'clients' as const,  label: 'Clientes & Contas' },
    { id: 'sync' as const,     label: 'Sincronização' },
    { id: 'storage' as const,  label: 'Armazenamento' },
  ]

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

      {/* ── Tab: Clientes ─────────────────────────────────────────────────────── */}
      {tab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Criar novo usuário</h2>
            <form onSubmit={createUser} className="space-y-3">
              <input
                placeholder="Nome completo"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition"
              >
                {creating ? 'Criando...' : 'Criar usuário'}
              </button>
              {createMsg && (
                <div>
                  <p className={`text-sm text-center ${createMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{createMsg.text}</p>
                  {createMsg.sql && (
                    <div className="mt-2">
                      <button onClick={() => setShowSql(v => !v)} className="text-xs text-slate-400 underline">{showSql ? 'Ocultar SQL' : 'Ver SQL'}</button>
                      {showSql && (
                        <pre className="mt-2 p-3 bg-[#0f172a] rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">{createMsg.sql}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Descobrir contas Meta automaticamente</h2>
            <DiscoverAccountsButton />
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Vincular conta de anúncio manualmente</h2>
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

      {/* ── Tab: Sincronização ────────────────────────────────────────────────── */}
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
              {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
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

      {/* ── Tab: Armazenamento ────────────────────────────────────────────────── */}
      {tab === 'storage' && (
        <div className="space-y-6">
          {storageLoading && (
            <div className="flex items-center justify-center py-20 text-slate-500 text-sm">Carregando estatísticas...</div>
          )}
          {storageError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{storageError}</div>
          )}

          {!storageLoading && !storageError && (
            <>
              {/* Barra de uso */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Uso total do banco</h2>
                <StorageBar usedBytes={totalBytes} />
              </div>

              {/* Prévia da limpeza + botão */}
              {preview && (
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-white font-semibold">Limpeza de dados antigos</h2>
                      <p className="text-slate-400 text-sm mt-0.5">
                        Com as configurações atuais, <span className="text-amber-400 font-medium">{preview.would_delete.total?.toLocaleString('pt-BR')} registros</span> seriam apagados.
                      </p>
                    </div>
                    <button
                      onClick={runCleanup}
                      disabled={cleaning || (preview.would_delete.total ?? 0) === 0}
                      className="bg-red-600/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition flex items-center gap-2"
                    >
                      {cleaning ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Limpando...
                        </>
                      ) : 'Executar limpeza'}
                    </button>
                  </div>

                  {cleanResult && (
                    <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                      <p className="text-emerald-400 text-sm font-medium mb-2">
                        Limpeza concluída! {cleanResult.total?.toLocaleString('pt-BR')} registros apagados.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(cleanResult).filter(([k]) => k !== 'total' && (cleanResult[k] ?? 0) > 0).map(([k, v]) => (
                          <div key={k} className="text-xs text-slate-400">
                            <span className="text-emerald-400 font-medium">{(v as number).toLocaleString('pt-BR')}</span> {PREVIEW_LABEL[k] ?? k}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(preview.would_delete).filter(([k]) => k !== 'total').map(([k, v]) => (
                      <div key={k} className={`rounded-xl px-3 py-2.5 border ${(v as number) > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900/30'}`}>
                        <p className={`text-lg font-bold ${(v as number) > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                          {(v as number).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">{PREVIEW_LABEL[k] ?? k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configurações de retenção */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-1">Períodos de retenção</h2>
                <p className="text-slate-500 text-sm mb-4">Configure quantos dias de histórico manter. 0 = manter para sempre.</p>
                <div className="space-y-3">
                  {settings.map(s => (
                    <div key={s.key} className="flex items-center gap-4 py-2 border-b border-slate-800/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">{LABEL[s.key] ?? s.key}</p>
                        <p className="text-slate-500 text-xs truncate">{s.description}</p>
                      </div>
                      {editingKey === s.key ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            className="w-20 bg-slate-800 text-white text-sm rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none text-center"
                            onKeyDown={e => { if (e.key === 'Enter') saveSetting(s.key); if (e.key === 'Escape') setEditingKey(null) }}
                            autoFocus
                          />
                          <span className="text-slate-500 text-xs">dias</span>
                          <button
                            onClick={() => saveSetting(s.key)}
                            disabled={savingKey === s.key}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition"
                          >
                            {savingKey === s.key ? '...' : 'OK'}
                          </button>
                          <button onClick={() => setEditingKey(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingKey(s.key); setEditingValue(String(s.value_days)) }}
                          className="flex items-center gap-2 text-slate-400 hover:text-white transition flex-shrink-0"
                        >
                          <span className="text-indigo-400 font-semibold text-sm">{s.value_days === 0 ? 'Nunca' : `${s.value_days}d`}</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabelas maiores */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold">Tamanho das tabelas</h2>
                  <button onClick={loadStorage} className="text-slate-500 hover:text-white text-xs transition">Atualizar</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Tabela', 'Registros', 'Tamanho', 'Barra'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-slate-400 font-medium text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tableStats.slice(0, 20).map(t => {
                        const pct = totalBytes > 0 ? (t.size_bytes / totalBytes) * 100 : 0
                        return (
                          <tr key={t.table_name} className="hover:bg-slate-800/20">
                            <td className="px-3 py-2 text-slate-300 text-xs font-mono">{t.table_name}</td>
                            <td className="px-3 py-2 text-slate-400 text-xs">{(t.row_count ?? 0).toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2 text-slate-300 text-xs font-medium">{t.total_size}</td>
                            <td className="px-3 py-2 w-32">
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct > 30 ? 'bg-red-500' : pct > 15 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${Math.max(pct, 1)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
