'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function DashboardTabs({ active }: { active: 'meta' | 'google' }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 bg-[#0d1117] border border-slate-800 rounded-xl p-1 w-fit">
      <button
        onClick={() => switchTab('meta')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
          active === 'meta'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>Meta Ads</span>
      </button>
      <button
        onClick={() => switchTab('google')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
          active === 'google'
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>Google Ads</span>
      </button>
    </div>
  )
}
