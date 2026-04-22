'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'kanban', label: 'Kanban' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'instancias', label: 'Instâncias WhatsApp' },
]

export function CrmTabs({ active }: { active: 'kanban' | 'contatos' | 'instancias' }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 bg-[#0d1117] border border-slate-800 rounded-xl p-1 w-fit">
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
