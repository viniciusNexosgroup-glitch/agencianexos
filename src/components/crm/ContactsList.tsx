'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatPanel } from './ChatPanel'
import { createBrowserClient } from '@/lib/supabase-browser'

// ─── Types ────────────────────────────────────────────────────────────────────

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  last_message_at: string | null
  last_message_body?: string | null
  remote_jid: string | null
  unread_count: number
  profile_pic_url?: string | null
  follow_up?: boolean
}

type Tag = {
  id: string
  name: string
  color: string
}

type Instance = {
  instance_name: string
  [key: string]: unknown
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-teal-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
  'bg-orange-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-rose-600',
]

const TAG_PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function isGroup(contact: Contact) {
  return contact.remote_jid?.endsWith('@g.us') || contact.phone?.includes('@g.us')
}

function formatTime(ts: string | null) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── TagBadge ─────────────────────────────────────────────────────────────────

function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
      style={{ backgroundColor: tag.color + '33', color: tag.color, border: `1px solid ${tag.color}55` }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="hover:opacity-70 transition leading-none"
          title="Remover tag"
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─── TagDropdown (para o header do chat) ──────────────────────────────────────

function TagDropdown({ contactId, onClose, onTagsChange }: { contactId: string; onClose: () => void; onTagsChange?: (tags: Tag[]) => void }) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [contactTags, setContactTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      const [tagsRes, contactTagsRes] = await Promise.all([
        fetch('/api/whatsapp/tags'),
        fetch(`/api/whatsapp/contacts/${contactId}/tags`),
      ])
      const tagsData = await tagsRes.json()
      const contactTagsData = await contactTagsRes.json()
      setAllTags(tagsData.tags ?? tagsData ?? [])
      setContactTags(contactTagsData.tags ?? contactTagsData ?? [])
      setLoading(false)
    }
    fetchData()
  }, [contactId])

  // Fecha ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  async function toggleTag(tag: Tag) {
    const has = contactTags.some(t => t.id === tag.id)
    let updated: Tag[]
    if (has) {
      await fetch(`/api/whatsapp/contacts/${contactId}/tags?tag_id=${tag.id}`, {
        method: 'DELETE',
      })
      updated = contactTags.filter(t => t.id !== tag.id)
    } else {
      await fetch(`/api/whatsapp/contacts/${contactId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      })
      updated = [...contactTags, tag]
    }
    setContactTags(updated)
    onTagsChange?.(updated)
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-52 bg-[#2a3942] border border-[#3d4f5a] rounded-xl shadow-2xl z-50 py-2"
    >
      <p className="text-[#8696a0] text-xs px-3 pb-2 font-medium uppercase tracking-wider">Tags</p>
      {loading && <p className="text-[#8696a0] text-xs text-center py-2">Carregando...</p>}
      {!loading && allTags.length === 0 && (
        <p className="text-[#8696a0] text-xs text-center py-2">Nenhuma tag criada</p>
      )}
      {allTags.map(tag => {
        const active = contactTags.some(t => t.id === tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#3d4f5a] transition text-left"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="text-sm text-[#e9edef] flex-1 truncate">{tag.name}</span>
            {active && (
              <svg className="w-4 h-4 text-[#00a884] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── ImportCSVModal ────────────────────────────────────────────────────────────

function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])
  const [instanceName, setInstanceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; ignored: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/whatsapp/instance')
      .then(r => r.json())
      .then(d => {
        const list: Instance[] = d.instances ?? d ?? []
        setInstances(list)
        if (list.length > 0) setInstanceName(list[0].instance_name)
      })
      .catch(() => {})
  }, [])

  async function handleImport() {
    if (!file || !instanceName) return
    setLoading(true)
    setError(null)
    setResult(null)
    const form = new FormData()
    form.append('file', file)
    form.append('instance_name', instanceName)
    try {
      const res = await fetch('/api/whatsapp/contacts/import', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setResult({ imported: data.imported ?? 0, ignored: data.ignored ?? 0 })
      onSuccess()
    } catch {
      setError('Erro ao importar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e2c35] border border-[#2a3942] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">Importar Contatos via CSV</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Importação concluída</p>
            <p className="text-[#8696a0] text-sm mt-1">
              <span className="text-green-400 font-semibold">{result.imported}</span> contatos importados,{' '}
              <span className="text-yellow-400 font-semibold">{result.ignored}</span> ignorados
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#00a884] hover:bg-[#06cf9c] text-white rounded-lg text-sm transition"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[#8696a0] text-xs font-medium block mb-1.5">Arquivo CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-[#e9edef] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#2a3942] file:text-[#e9edef] hover:file:bg-[#3d4f5a] file:transition file:cursor-pointer bg-[#2a3942] rounded-lg px-3 py-2 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[#8696a0] text-xs font-medium block mb-1.5">Instância WhatsApp</label>
              <select
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3d4f5a] focus:border-[#00a884] transition"
              >
                {instances.map(i => (
                  <option key={i.instance_name} value={i.instance_name}>{i.instance_name}</option>
                ))}
                {instances.length === 0 && <option value="">Nenhuma instância</option>}
              </select>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm text-[#8696a0] hover:text-white border border-[#3d4f5a] rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!file || !instanceName || loading}
                className="flex-1 py-2 text-sm bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white rounded-lg transition font-medium"
              >
                {loading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TagManagerModal ───────────────────────────────────────────────────────────

function TagManagerModal({ onClose, onTagsChanged }: { onClose: () => void; onTagsChanged: () => void }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_PRESET_COLORS[0])
  const [creating, setCreating] = useState(false)

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/whatsapp/tags')
    const data = await res.json()
    setTags(data.tags ?? data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTags() }, [fetchTags])

  async function createTag() {
    if (!newName.trim() || creating) return
    setCreating(true)
    await fetch('/api/whatsapp/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setNewName('')
    setCreating(false)
    await fetchTags()
    onTagsChanged()
  }

  async function deleteTag(id: string) {
    await fetch(`/api/whatsapp/tags?id=${id}`, { method: 'DELETE' })
    setTags(prev => prev.filter(t => t.id !== id))
    onTagsChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e2c35] border border-[#2a3942] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">Gerenciar Tags</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Criar nova tag */}
        <div className="bg-[#2a3942] rounded-xl p-3 mb-4">
          <p className="text-[#8696a0] text-xs font-medium mb-2">Nova tag</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTag()}
              placeholder="Nome da tag"
              className="flex-1 bg-[#1e2c35] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3d4f5a] focus:border-[#00a884] placeholder-[#8696a0] transition"
            />
            <button
              onClick={createTag}
              disabled={!newName.trim() || creating}
              className="px-3 py-2 bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#3d4f5a] disabled:text-[#8696a0] text-white rounded-lg text-sm transition font-medium"
            >
              {creating ? '...' : 'Criar'}
            </button>
          </div>
          {/* Seletor de cor */}
          <div className="flex gap-2 mt-2.5">
            {TAG_PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full transition ring-offset-[#2a3942] ring-offset-2"
                style={{
                  backgroundColor: c,
                  outline: newColor === c ? `2px solid ${c}` : '2px solid transparent',
                  outlineOffset: '2px',
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Lista de tags */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {loading && <p className="text-[#8696a0] text-xs text-center py-4">Carregando...</p>}
          {!loading && tags.length === 0 && (
            <p className="text-[#8696a0] text-xs text-center py-4">Nenhuma tag criada ainda</p>
          )}
          {tags.map(tag => (
            <div
              key={tag.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#2a3942] group"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="text-sm text-[#e9edef] flex-1">{tag.name}</span>
              <button
                onClick={() => deleteTag(tag.id)}
                className="text-[#8696a0] hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                title="Deletar tag"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ChatPanelWithTags (wrapper que adiciona botão de tags no header) ──────────

function ChatPanelWithTags({
  contact,
  onClose,
  funnels,
  onOpenContact,
  onContactTagsChange,
  onFollowUpChange,
}: {
  contact: Contact
  onClose: () => void
  funnels: { id: string; name: string; crm_stages: { id: string; name: string }[] }[]
  onOpenContact?: (phone: string, instanceName: string) => void
  onContactTagsChange?: (contactId: string, tags: Tag[]) => void
  onFollowUpChange?: (contactId: string, value: boolean) => void
}) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)

  const tagButton = (
    <div className="relative">
      <button
        onClick={() => setTagDropdownOpen(p => !p)}
        title="Gerenciar tags do contato"
        className={`p-1.5 rounded-full transition ${tagDropdownOpen ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      </button>
      {tagDropdownOpen && (
        <TagDropdown
          contactId={contact.id}
          onClose={() => setTagDropdownOpen(false)}
          onTagsChange={tags => onContactTagsChange?.(contact.id, tags)}
        />
      )}
    </div>
  )

  return (
    <ChatPanel
      contact={contact}
      onClose={onClose}
      funnels={funnels}
      onOpenContact={onOpenContact}
      onFollowUpChange={onFollowUpChange}
      tagButton={tagButton}
    />
  )
}

type SavedFilter = {
  name: string
  tagId: string | null
  type: 'all' | 'individual' | 'group'
  instanceName: string
}

// ─── ContactsList (componente principal) ──────────────────────────────────────

export function ContactsList({ funnels }: { funnels: { id: string; name: string; crm_stages: { id: string; name: string }[] }[] }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [chatContact, setChatContact] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [contactTagsMap, setContactTagsMap] = useState<Record<string, Tag[]>>({})
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  // Filtros avançados
  const [instances, setInstances] = useState<{ instance_name: string }[]>([])
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'group'>('all')
  const [filterInstance, setFilterInstance] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [filterName, setFilterName] = useState('')

  // Contagem local de não lidas (rastreada via Realtime, independente do banco)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})

  // Modais
  const [showImport, setShowImport] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/whatsapp/tags')
    const data = await res.json()
    setAllTags(data.tags ?? data ?? [])
  }, [])

  const chatContactRef = useRef<Contact | null>(null)

  async function fetchContacts() {
    const { data } = await createBrowserClient()
      .from('whatsapp_contacts')
      .select('id, name, phone, instance_name, last_message_at, last_message_body, remote_jid, unread_count, profile_pic_url')
      .not('phone', 'like', '%@lid')
      .not('phone', 'eq', 'status@broadcast')
      .order('last_message_at', { ascending: false })
    return data ?? []
  }

  // Carrega TODAS as tags de contatos via rota server-side (service role — sem problema de RLS)
  async function fetchAllContactTags() {
    try {
      const res = await fetch('/api/whatsapp/contact-tags')
      if (!res.ok) {
        console.error('[CRM] Erro ao carregar tags de contatos:', res.status)
        return
      }
      const data = await res.json()
      const map = data.contactTags as Record<string, Tag[]>
      if (map) setContactTagsMap(prev => ({ ...prev, ...map }))
    } catch (err) {
      console.error('[CRM] Erro ao carregar tags de contatos:', err)
    }
  }

  function applyContacts(raw: any[]) {
    const currentId = chatContactRef.current?.id
    const list: Contact[] = raw.map((c: any) => ({
      ...c,
      unread_count: Number(c.unread_count ?? 0),
    }))
    const merged = list.map(c =>
      currentId && c.id === currentId ? { ...c, unread_count: 0 } : c
    )
    merged.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    })
    setContacts(merged)
  }

  async function load() {
    try {
      const raw = await fetchContacts()
      applyContacts(raw)
    } catch (err) {
      console.error('[CRM] Erro inicial:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchContactTags(contactId: string) {
    if (contactTagsMap[contactId]) return
    try {
      const res = await fetch(`/api/whatsapp/contacts/${contactId}/tags`)
      const data = await res.json()
      const tags: Tag[] = data.tags ?? data ?? []
      setContactTagsMap(prev => ({ ...prev, [contactId]: tags }))
    } catch {
      setContactTagsMap(prev => ({ ...prev, [contactId]: [] }))
    }
  }

  useEffect(() => {
    load()
    fetchTags()
    fetchAllContactTags()
    fetch('/api/whatsapp/instance').then(r => r.json()).then(d => setInstances(d.instances ?? d ?? []))
    try {
      const saved = JSON.parse(localStorage.getItem('crm_saved_filters') || '[]')
      setSavedFilters(saved)
    } catch { /* ignore */ }

    // Realtime: atualiza instantaneamente quando contato muda
    const sb = createBrowserClient()
    const channel = sb
      .channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_contacts' }, async (payload) => {
        // Atualiza apenas o contato que mudou sem rebuscar tudo
        if (payload.new && typeof payload.new === 'object') {
          const updated = payload.new as any
          setContacts(prev => {
            const exists = prev.some(c => c.id === updated.id)
            const currentId = chatContactRef.current?.id
            const newContact: Contact = {
              ...updated,
              unread_count: currentId === updated.id ? 0 : Number(updated.unread_count ?? 0),
            }
            const next = exists
              ? prev.map(c => c.id === updated.id ? newContact : c)
              : [newContact, ...prev]
            return [...next].sort((a, b) => {
              const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
              const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
              return tb - ta
            })
          })
        }
      })
      .subscribe()

    // Realtime em mensagens: move para o topo e incrementa badge
    const msgChannel = sb
      .channel('new-messages-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const msg = payload.new as any
        if (!msg?.contact_id) return

        const isOpenChat = msg.contact_id === chatContactRef.current?.id

        // Move contato para o topo sempre que chegar mensagem nova (qualquer remetente)
        if (!isOpenChat) {
          setContacts(prev => {
            const idx = prev.findIndex(c => c.id === msg.contact_id)
            if (idx <= 0) return prev
            const updated = [...prev]
            const [moved] = updated.splice(idx, 1)
            return [moved, ...updated]
          })
        }

        // Incrementa badge apenas para mensagens recebidas (não enviadas por mim)
        if (!msg.from_me && !isOpenChat) {
          setUnreadMap(prev => ({ ...prev, [msg.contact_id]: (prev[msg.contact_id] ?? 0) + 1 }))
        }
      })
      .subscribe()

    // Loop de polling como fallback (caso Realtime não dispare)
    let active = true
    async function pollLoop() {
      while (active) {
        await new Promise(r => setTimeout(r, 4000))
        if (!active) break
        try {
          const raw = await fetchContacts()
          applyContacts(raw)
        } catch { /* silencioso */ }
      }
    }
    pollLoop()

    return () => {
      active = false
      sb.removeChannel(channel)
      sb.removeChannel(msgChannel)
    }
  }, [])

  // fetchContactTags mantido para atualização individual após edição no modal

  function saveCurrentFilter() {
    if (!filterName.trim()) return
    const f: SavedFilter = { name: filterName.trim(), tagId: activeTagFilter, type: filterType, instanceName: filterInstance }
    const updated = [...savedFilters.filter(s => s.name !== f.name), f]
    setSavedFilters(updated)
    localStorage.setItem('crm_saved_filters', JSON.stringify(updated))
    setFilterName('')
  }

  function applyFilter(f: SavedFilter) {
    setActiveTagFilter(f.tagId)
    setFilterType(f.type)
    setFilterInstance(f.instanceName)
  }

  function deleteFilter(name: string) {
    const updated = savedFilters.filter(s => s.name !== name)
    setSavedFilters(updated)
    localStorage.setItem('crm_saved_filters', JSON.stringify(updated))
  }

  const filtered = contacts.filter(c => {

    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    if (!matchSearch) return false
    if (activeTagFilter) {
      const tags = contactTagsMap[c.id] ?? []
      if (!tags.some(t => t.id === activeTagFilter)) return false
    }
    if (filterType === 'individual' && isGroup(c)) return false
    if (filterType === 'group' && !isGroup(c)) return false
    if (filterInstance && c.instance_name !== filterInstance) return false
    return true
  })

  async function markAllRead() {
    // Zera localmente de imediato
    setUnreadMap({})
    setContacts(prev => prev.map(c => ({ ...c, unread_count: 0 })))
    // Persiste no banco para cada contato com unread > 0
    const withUnread = contacts.filter(c => c.unread_count > 0 || (unreadMap[c.id] ?? 0) > 0)
    await Promise.all(
      withUnread.map(c =>
        fetch(`/api/whatsapp/contacts/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read' }),
        }).catch(() => {})
      )
    )
  }

  function handleSelectContact(contact: Contact) {
    chatContactRef.current = contact
    setChatContact(contact)
    fetchContactTags(contact.id)
    // Zera badge local e no banco ao abrir conversa
    setUnreadMap(prev => ({ ...prev, [contact.id]: 0 }))
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unread_count: 0 } : c))
    fetch(`/api/whatsapp/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    }).catch(() => {})
  }

  async function handleOpenContact(phone: string, instanceName: string) {
    // Busca primeiro nos contatos já carregados
    const existing = contacts.find(c => c.phone === phone && c.instance_name === instanceName)
    if (existing) { handleSelectContact(existing); return }
    // Se não encontrado, busca no banco
    const sb = createBrowserClient()
    const { data } = await sb
      .from('whatsapp_contacts')
      .select('id, name, phone, instance_name, last_message_at, last_message_body, remote_jid, unread_count, profile_pic_url')
      .eq('instance_name', instanceName)
      .eq('phone', phone)
      .maybeSingle()
    if (data) handleSelectContact(data as Contact)
  }

  return (
    <>
      <div className="flex h-[calc(100vh-160px)] rounded-xl overflow-hidden border border-[#222e35]">
        {/* Sidebar */}
        <div className={`flex flex-col bg-[#111b21] ${chatContact ? 'hidden md:flex w-[360px] flex-shrink-0' : 'flex-1 md:w-[360px] md:flex-shrink-0'}`}>

          {/* Header */}
          <div className="px-4 py-3 bg-[#202c33] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              WA
            </div>
            <span className="text-white font-semibold flex-1">Conversas</span>
            {/* Botão marcar todas como lidas */}
            <button
              onClick={markAllRead}
              title="Marcar todas como lidas"
              className="text-[#8696a0] hover:text-white transition p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </button>
            {/* Botão importar CSV */}
            <button
              onClick={() => setShowImport(true)}
              title="Importar CSV"
              className="text-[#8696a0] hover:text-white transition p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            {/* Botão filtros */}
            <button
              onClick={() => setShowFilters(v => !v)}
              title="Filtros avançados"
              className={`text-[#8696a0] hover:text-white transition p-1 ${showFilters ? 'text-[#00a884]' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            {/* Botão gerenciar tags */}
            <button
              onClick={() => setShowTagManager(true)}
              title="Gerenciar Tags"
              className="text-[#8696a0] hover:text-white transition p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Filtro por tags */}
          {allTags.length > 0 && (
            <div className="px-3 py-2 bg-[#111b21] flex gap-1.5 flex-wrap border-b border-[#222e35]">
              <button
                onClick={() => setActiveTagFilter(null)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${
                  activeTagFilter === null
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                }`}
              >
                Todos
              </button>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                  className="px-2 py-1 rounded-full text-[10px] font-medium transition"
                  style={
                    activeTagFilter === tag.id
                      ? { backgroundColor: tag.color, color: '#fff' }
                      : { backgroundColor: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2 bg-[#111b21]">
            <div className="flex items-center bg-[#202c33] rounded-lg px-3 gap-2">
              <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar ou começar uma conversa"
                className="flex-1 bg-transparent text-white text-sm py-2 outline-none placeholder-[#8696a0]"
              />
            </div>
          </div>

          {/* Filtros avançados */}
          {showFilters && (
            <div className="px-3 py-3 bg-[#111b21] border-b border-[#222e35] space-y-2">
              <div className="flex gap-1.5">
                {(['all', 'individual', 'group'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`flex-1 py-1 rounded text-[10px] font-medium transition ${filterType === t ? 'bg-[#00a884] text-white' : 'bg-[#202c33] text-[#8696a0]'}`}>
                    {t === 'all' ? 'Todos' : t === 'individual' ? 'Individual' : 'Grupos'}
                  </button>
                ))}
              </div>
              {instances.length > 1 && (
                <select value={filterInstance} onChange={e => setFilterInstance(e.target.value)}
                  className="w-full bg-[#202c33] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#2a3942] transition">
                  <option value="">Todas as instâncias</option>
                  {instances.map(i => <option key={i.instance_name} value={i.instance_name}>{i.instance_name}</option>)}
                </select>
              )}
              <div className="flex gap-1.5">
                <input value={filterName} onChange={e => setFilterName(e.target.value)}
                  placeholder="Nome do filtro..."
                  className="flex-1 bg-[#202c33] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#2a3942] placeholder-[#8696a0] transition" />
                <button onClick={saveCurrentFilter} disabled={!filterName.trim()}
                  className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] rounded transition font-medium">
                  Salvar
                </button>
                <button onClick={() => { setFilterType('all'); setFilterInstance(''); setActiveTagFilter(null) }}
                  className="px-2 py-1.5 text-[#8696a0] hover:text-white text-[10px] border border-[#2a3942] rounded transition">
                  Limpar
                </button>
              </div>
              {savedFilters.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {savedFilters.map(f => (
                    <div key={f.name} className="flex items-center gap-0.5 bg-[#2a3942] rounded px-2 py-0.5">
                      <button onClick={() => applyFilter(f)} className="text-[#e9edef] text-[10px] hover:text-[#00a884] transition">{f.name}</button>
                      <button onClick={() => deleteFilter(f.name)} className="text-[#8696a0] hover:text-red-400 transition text-xs leading-none ml-0.5">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="text-[#8696a0] text-sm text-center py-8">Carregando...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-[#8696a0] text-sm text-center py-8 px-4">
                {contacts.length === 0
                  ? 'Nenhuma conversa ainda. Aguarde mensagens chegarem.'
                  : 'Nenhum resultado.'}
              </p>
            )}
            {filtered.map(contact => {
              const tags = contactTagsMap[contact.id] ?? []
              const unread = chatContact?.id === contact.id ? 0 : Math.max(unreadMap[contact.id] ?? 0, Number(contact.unread_count ?? 0))
              return (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#202c33] transition border-b border-[#222e35] ${
                    chatContact?.id === contact.id ? 'bg-[#2a3942]' : ''
                  }`}
                >
                  {/* Avatar */}
                  {(contact as any).profile_pic_url ? (
                    <img
                      src={(contact as any).profile_pic_url}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full flex-shrink-0 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style') }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${avatarColor(contact.name)}`} style={(contact as any).profile_pic_url ? { display: 'none' } : {}}>
                    {isGroup(contact)
                      ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                      : getInitials(contact.name)
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        {contact.follow_up && (
                          <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                          </svg>
                        )}
                        <span className={`text-sm truncate ${unread > 0 ? 'text-white font-semibold' : 'text-white font-medium'}`}>{contact.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {contact.last_message_at && (
                          <span className={`text-xs ${unread > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                            {formatTime(contact.last_message_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="text-[#8696a0] text-xs truncate">
                          {contact.last_message_body || (isGroup(contact) ? 'Grupo' : contact.phone)}
                        </span>
                      </div>
                      {unread > 0 && (
                        <span className="ml-1 flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00a884] text-white text-[11px] font-bold flex items-center justify-center leading-none">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                    {/* Tags do contato */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tags.map(tag => (
                          <TagBadge key={tag.id} tag={tag} />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col bg-[#0b141a] ${!chatContact ? 'hidden md:flex' : 'flex'}`}>
          {chatContact ? (
            <ChatPanelWithTags
              contact={chatContact}
              onClose={() => { chatContactRef.current = null; setChatContact(null) }}
              funnels={funnels}
              onOpenContact={handleOpenContact}
              onContactTagsChange={(contactId, tags) =>
                setContactTagsMap(prev => ({ ...prev, [contactId]: tags }))
              }
              onFollowUpChange={(contactId, value) => {
                setContacts(prev => prev.map(c => c.id === contactId ? { ...c, follow_up: value } : c))
                setChatContact(prev => prev && prev.id === contactId ? { ...prev, follow_up: value } : prev)
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-[#8696a0]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <h3 className="text-[#e9edef] text-xl font-light mb-2">WhatsApp CRM</h3>
              <p className="text-[#8696a0] text-sm">Selecione uma conversa para abrir</p>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { load(); setShowImport(false) }}
        />
      )}
      {showTagManager && (
        <TagManagerModal
          onClose={() => setShowTagManager(false)}
          onTagsChanged={() => { fetchTags(); fetchAllContactTags() }}
        />
      )}
    </>
  )
}
