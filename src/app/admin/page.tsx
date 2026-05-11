export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { AdminPanel } from '@/components/AdminPanel'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.is_admin) redirect('/dashboard')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, is_admin, created_at')
    .order('created_at', { ascending: false })

  const { data: allAccounts } = await supabase
    .from('client_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: syncLogs } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-[#080b12]">
      <header className="border-b border-slate-800 bg-[#0d1117] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-white font-semibold">Admin Panel</h1>
          </div>
          <a href="/dashboard" className="text-slate-400 hover:text-white text-sm transition">← Dashboard</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AdminPanel
          clients={clients || []}
          allAccounts={allAccounts || []}
          syncLogs={syncLogs || []}
        />
      </main>
    </div>
  )
}
