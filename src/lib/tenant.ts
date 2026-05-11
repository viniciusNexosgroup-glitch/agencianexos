/**
 * tenant.ts — helpers de isolamento multi-tenant
 *
 * Modelo de dados:
 *   whatsapp_instances.created_by = session.email  (TEXT)
 *   outras tabelas.created_by     = session.sub    (UUID)
 *
 * Admins (is_admin = true) veem TUDO sem filtro.
 * Usuários comuns veem apenas dados das suas próprias instâncias.
 *
 * IMPORTANTE: is_admin é sempre verificado diretamente no banco (não no JWT)
 * para garantir isolamento correto mesmo que o JWT esteja desatualizado.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { SessionUser } from './session'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function isAdmin(session: SessionUser): Promise<boolean> {
  const { data } = await db()
    .from('clients')
    .select('is_admin')
    .eq('id', session.sub)
    .single()
  return !!data?.is_admin
}

/**
 * Retorna os instance_names que pertencem ao usuário logado.
 * - Admin → null (sem filtro; o chamador deve retornar todos os dados)
 * - Usuário com 0 instâncias → [] (sem acesso a nada)
 */
export async function getUserInstanceNames(session: SessionUser): Promise<string[] | null> {
  if (await isAdmin(session)) return null
  const { data } = await db()
    .from('whatsapp_instances')
    .select('instance_name')
    .eq('created_by', session.email)
  return (data ?? []).map(i => i.instance_name as string)
}

/**
 * Verifica se o usuário tem acesso à instância pelo nome.
 * Admin → sempre true.
 */
export async function canAccessInstance(instanceName: string, session: SessionUser): Promise<boolean> {
  if (await isAdmin(session)) return true
  const { data } = await db()
    .from('whatsapp_instances')
    .select('instance_name')
    .eq('instance_name', instanceName)
    .eq('created_by', session.email)
    .maybeSingle()
  return data !== null
}

/**
 * Verifica se o usuário tem acesso ao contato (via instance_name da instância).
 * Admin → sempre true.
 */
export async function canAccessContact(contactId: string, session: SessionUser): Promise<boolean> {
  if (await isAdmin(session)) return true
  const names = await getUserInstanceNames(session)
  if (!names || names.length === 0) return false
  const { data } = await db()
    .from('whatsapp_contacts')
    .select('id')
    .eq('id', contactId)
    .in('instance_name', names)
    .maybeSingle()
  return data !== null
}

/** Retorna 403 Acesso negado */
export const denied = () =>
  NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
