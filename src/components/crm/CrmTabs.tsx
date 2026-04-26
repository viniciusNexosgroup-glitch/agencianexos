'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'kanban',     label: 'Kanban' },
  { key: 'contatos',   label: 'Contatos' },
  { key: 'instancias', label: 'Instâncias' },
  { key: 'broadcast',  label: 'Broadcast' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'flows',      label: 'Flows' },
  { key: 'ia',         label: 'Agente IA' },
  { key: 'followup',   label: 'Follow-up' },
]

export type CrmTab = 'kanban' | 'contatos' | 'instancias' | 'broadcast' | 'supervisor' | 'flows' | 'ia' | 'followup'

export function CrmTabs({ active }: { active: CrmTab }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 flex-wrap bg-[#0d1117] border border-slate-800 rounded-xl p-1 w-fit">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => switchTab(t.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            active === t.key
              ? 'bg-green-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
