import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: client } = await supabase
    .from('clients')
    .select('name, is_admin')
    .eq('id', session.sub)
    .single()

  return (
    <div className="flex min-h-screen bg-[#080b12]">
      <Sidebar
        userName={client?.name || session.email}
        isAdmin={!!client?.is_admin}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
