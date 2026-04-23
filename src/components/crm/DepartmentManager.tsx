'use client'

import { useState, useEffect } from 'react'

type Agent = { id: string; name: string; email: string; is_admin: boolean }
type Department = {
  id: string
  name: string
  created_at: string
  department_members: { user_id: string; clients: Agent }[]
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    try {
      const [dRes, aRes] = await Promise.all([
        fetch('/api/whatsapp/departments'),
        fetch('/api/whatsapp/agents'),
      ])
      const dData = await dRes.json()
      const aData = await aRes.json()
      setDepartments(dData.departments ?? [])
      setAgents(aData.agents ?? [])
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createDept() {
    if (!newName.trim() || creating) return
    setCreating(true)
    await fetch('/api/whatsapp/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    setCreating(false)
    await load()
  }

  async function deleteDept(id: string) {
    if (!confirm('Excluir departamento?')) return
    await fetch(`/api/whatsapp/departments?id=${id}`, { method: 'DELETE' })
    setDepartments(prev => prev.filter(d => d.id !== id))
  }

  async function toggleMember(deptId: string, userId: string, isMember: boolean) {
    await fetch('/api/whatsapp/departments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isMember
          ? { id: deptId, remove_user_id: userId }
          : { id: deptId, add_user_id: userId }
      ),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Carregando departamentos...
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-white text-lg font-semibold">Departamentos</h2>
        <p className="text-slate-500 text-sm mt-1">
          Organize agentes em departamentos e roteie conversas automaticamente.
        </p>
      </div>

      {/* Criar departamento */}
      <div className="bg-[#0d1117] border border-slate-800 rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Novo departamento</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createDept()}
            placeholder="Ex: Vendas, Suporte, Financeiro..."
            className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-700 focus:border-indigo-500 placeholder-slate-500 transition"
          />
          <button
            onClick={createDept}
            disabled={!newName.trim() || creating}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
          >
            {creating ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </div>

      {/* Lista de departamentos */}
      {departments.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Nenhum departamento criado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map(dept => {
            const memberIds = dept.department_members.map(m => m.user_id)
            const isExpanded = expandedId === dept.id

            return (
              <div key={dept.id} className="bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{dept.name}</p>
                    <p className="text-slate-500 text-xs">
                      {memberIds.length} agente{memberIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : dept.id)}
                    className="text-slate-400 hover:text-white transition p-1 rounded"
                  >
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteDept(dept.id)}
                    className="text-slate-600 hover:text-red-400 transition p-1 rounded"
                    title="Excluir departamento"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 px-4 py-3">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Agentes</p>
                    <div className="space-y-2">
                      {agents.map(agent => {
                        const isMember = memberIds.includes(agent.id)
                        return (
                          <div key={agent.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {agent.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-300 text-sm truncate">{agent.name}</p>
                              <p className="text-slate-600 text-xs truncate">{agent.email}</p>
                            </div>
                            <button
                              onClick={() => toggleMember(dept.id, agent.id, isMember)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                                isMember
                                  ? 'bg-indigo-900/60 text-indigo-300 hover:bg-red-900/40 hover:text-red-400'
                                  : 'bg-slate-800 text-slate-400 hover:bg-indigo-900/40 hover:text-indigo-300'
                              }`}
                            >
                              {isMember ? 'Remover' : 'Adicionar'}
                            </button>
                          </div>
                        )
                      })}
                      {agents.length === 0 && (
                        <p className="text-slate-600 text-xs">Nenhum agente cadastrado.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
