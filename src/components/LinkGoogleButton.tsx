'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  adAccountId: string
  linkedCustomerId?: string | null
}

interface GoogleAccount {
  customer_id: string
  name: string
}

export function LinkGoogleButton({ adAccountId, linkedCustomerId }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [linked, setLinked] = useState(linkedCustomerId ?? null)
  const [linking, setLinking] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLinked(linkedCustomerId ?? null)
  }, [linkedCustomerId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setShowModal(false)
    }
    if (showModal) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showModal])

  async function openModal() {
    setShowModal(true)
    if (accounts.length > 0) return
    setLoading(true)
    const res = await fetch('/api/google/accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
    setLoading(false)
  }

  async function link(customerId: string | null) {
    setLinking(true)
    await fetch('/api/accounts/link-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adAccountId, googleCustomerId: customerId }),
    })
    setLinked(customerId)
    setLinking(false)
    setShowModal(false)
  }

  const linkedAccount = accounts.find(a => a.customer_id === linked)

  return (
    <div className="relative">
      <button
        onClick={openModal}
        title={linked ? 'Google Ads vinculado — clique para alterar' : 'Vincular conta Google Ads'}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition border font-medium ${
          linked
            ? 'bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 border-blue-600/40'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {linked ? (linkedAccount?.name || linked) : 'Google Ads'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div ref={modalRef} className="bg-[#1e293b] border border-slate-700 rounded-2xl p-5 w-80 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Vincular Google Ads</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Nenhuma conta Google Ads encontrada</p>
            ) : (
              <div className="space-y-1">
                {accounts.map(a => (
                  <button
                    key={a.customer_id}
                    onClick={() => link(a.customer_id)}
                    disabled={linking}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition ${
                      linked === a.customer_id
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="mr-2">📊</span>
                    <span>{a.name}</span>
                    <span className="ml-2 text-xs opacity-50">{a.customer_id}</span>
                  </button>
                ))}
              </div>
            )}

            {linked && (
              <button
                onClick={() => link(null)}
                disabled={linking}
                className="mt-3 w-full text-xs text-red-400 hover:text-red-300 py-2 text-center"
              >
                Desvincular Google Ads
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
