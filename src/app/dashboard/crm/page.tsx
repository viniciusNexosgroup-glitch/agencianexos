import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { InstanceManager } from '@/components/crm/InstanceManager'
import { ContactsList } from '@/components/crm/ContactsList'
import { FunnelManager } from '@/components/crm/FunnelManager'
import { CrmTabs } from '@/components/crm/CrmTabs'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function CrmPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const tab = searchParams.tab || 'kanban'
  const db = supabase()

  const { data: funnels } = await db
    .from('crm_funnels')
    .select('*, crm_stages(*)')
    .order('created_at', { ascending: true })

  return (
    <div className="flex-1 text-white px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">CRM WhatsApp</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie leads e conversas do WhatsApp</p>
      </div>

      <CrmTabs active={tab as any} />

      <div className={tab === 'contatos' ? 'mt-4' : 'mt-6'}>
        {tab === 'kanban' && (
          <FunnelManager funnels={funnels ?? []} />
        )}
        {tab === 'contatos' && (
          <ContactsList funnels={funnels ?? []} />
        )}
        {tab === 'instancias' && (
          <InstanceManager />
        )}
      </div>
    </div>
  )
}
