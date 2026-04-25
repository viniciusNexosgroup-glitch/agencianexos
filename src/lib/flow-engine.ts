import { SupabaseClient } from '@supabase/supabase-js'
import { sendTextMessage } from './evolution'

interface FlowStep {
  id: string
  type: 'message' | 'tag' | 'assign' | 'condition'
  delay_hours?: number
  message?: string
  tag_name?: string
  agent_id?: string
  condition_keyword?: string
  condition_goto?: number
}

interface Flow {
  id: string
  instance_name: string
  trigger_type: 'keyword' | 'first_message' | 'manual'
  trigger_value: string | null
  steps: FlowStep[]
}

function triggerMatches(flow: Flow, text: string, isFirstMessage: boolean): boolean {
  if (flow.trigger_type === 'keyword') {
    if (!flow.trigger_value || !text) return false
    return text.toLowerCase().includes(flow.trigger_value.toLowerCase())
  }
  if (flow.trigger_type === 'first_message') {
    return isFirstMessage
  }
  return false
}

async function executeStep(
  db: SupabaseClient,
  step: FlowStep,
  instanceName: string,
  remoteJid: string,
  contactId: string
) {
  try {
    if (step.type === 'message' && step.message) {
      console.log('[FlowEngine] enviando mensagem para', remoteJid, ':', step.message)
      const sendResult = await sendTextMessage(instanceName, remoteJid, step.message)
      console.log('[FlowEngine] resultado envio:', JSON.stringify(sendResult))

      // Salva a mensagem enviada pelo flow no banco
      await db.from('whatsapp_messages').insert({
        contact_id: contactId,
        message_id: `flow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        body: step.message,
        from_me: true,
        timestamp: new Date().toISOString(),
        message_type: 'conversation',
      }).catch(() => {})

      await db.rpc('update_last_message', {
        p_contact_id: contactId,
        p_body: step.message,
        p_timestamp: new Date().toISOString(),
      }).catch(() => {})
    }

    if (step.type === 'tag' && step.tag_name) {
      const { data: tag } = await db
        .from('tags')
        .select('id')
        .eq('name', step.tag_name)
        .maybeSingle()

      if (tag?.id) {
        await db.from('contact_tags').upsert(
          { contact_id: contactId, tag_id: tag.id },
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
        ).catch(() => {})
      }
    }

    if (step.type === 'assign' && step.agent_id) {
      await db
        .from('whatsapp_contacts')
        .update({ assigned_to: step.agent_id })
        .eq('id', contactId)
        .catch(() => {})
    }
  } catch (err) {
    console.error('[FlowEngine] Erro ao executar step:', step.type, err)
  }
}

export async function runFlowsForMessage(
  db: SupabaseClient,
  instanceName: string,
  remoteJid: string,
  contactId: string,
  text: string,
  isFirstMessage: boolean
) {
  try {
    const { data: flows, error: flowsError } = await db
      .from('flows')
      .select('id, trigger_type, trigger_value, steps')
      .eq('instance_name', instanceName)
      .eq('is_active', true)

    console.log('[FlowEngine] flows ativos para', instanceName, ':', flows?.length ?? 0, flowsError?.message ?? '')

    if (!flows || flows.length === 0) return

    for (const flow of flows as Flow[]) {
      const steps: FlowStep[] = flow.steps ?? []
      console.log('[FlowEngine] avaliando flow', flow.id, 'trigger:', flow.trigger_type, flow.trigger_value, 'steps:', steps.length, 'text:', text)
      if (steps.length === 0) { console.log('[FlowEngine] sem steps, pulando'); continue }
      if (!triggerMatches(flow, text, isFirstMessage)) { console.log('[FlowEngine] trigger não bateu, pulando'); continue }

      console.log('[FlowEngine] trigger bateu! executando flow', flow.id)

      // Não dispara o mesmo flow duas vezes para o mesmo contato
      const { data: existing } = await db
        .from('flow_executions')
        .select('id')
        .eq('flow_id', flow.id)
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) continue

      // Registra execução
      const { data: exec } = await db
        .from('flow_executions')
        .insert({ flow_id: flow.id, contact_id: contactId, status: 'active', variables: {} })
        .select('id')
        .single()

      // Executa steps sem delay imediatamente
      for (const step of steps) {
        if ((step.delay_hours ?? 0) > 0) break // para ao encontrar delay

        if (step.type === 'condition') {
          // Condição: se texto contém keyword, pula para outro step (básico)
          if (step.condition_keyword && text.toLowerCase().includes(step.condition_keyword.toLowerCase())) {
            break // implementação futura: goto step
          }
          continue
        }

        await executeStep(db, step, instanceName, remoteJid, contactId)
      }

      if (exec?.id) {
        await db.from('flow_executions').update({ status: 'completed' }).eq('id', exec.id)
      }
    }
  } catch (err) {
    console.error('[FlowEngine] Erro ao executar flows:', err)
  }
}
