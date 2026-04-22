/**
 * Sync standalone — Meta Ads Dashboard
 * Executa: node scripts/sync-metrics.js
 * Agende com cron ou rode manualmente a cada 15 dias.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`
const TOKEN = process.env.META_ACCESS_TOKEN
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function today() { return new Date().toISOString().split('T')[0] }
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }

function extractAction(actions, type) {
  return parseInt((actions || []).find(a => a.action_type === type)?.value || '0')
}
function extractActionValue(actionValues, type) {
  return parseFloat((actionValues || []).find(a => a.action_type === type)?.value || '0')
}

async function fetchInsights(adAccountId, from, to) {
  const allData = []
  let url = `${BASE}/${adAccountId}/insights`
  let firstCall = true

  const params = {
    access_token: TOKEN,
    fields: 'campaign_id,campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,frequency,actions,action_values',
    level: 'campaign',
    time_range: JSON.stringify({ since: from, until: to }),
    time_increment: '1',
    limit: '500',
  }

  while (url) {
    const response = firstCall
      ? await axios.get(url, { params })
      : await axios.get(url)
    firstCall = false
    allData.push(...(response.data.data || []))
    url = response.data.paging?.next || null
  }

  return allData.map(item => ({
    ad_account_id: adAccountId,
    campaign_id: item.campaign_id,
    campaign_name: item.campaign_name,
    metric_date: item.date_start,
    impressions: parseInt(item.impressions || '0'),
    reach: parseInt(item.reach || '0'),
    clicks: parseInt(item.clicks || '0'),
    spend: parseFloat(item.spend || '0'),
    ctr: parseFloat(item.ctr || '0'),
    cpc: item.cpc ? parseFloat(item.cpc) : null,
    cpm: item.cpm ? parseFloat(item.cpm) : null,
    frequency: parseFloat(item.frequency || '0'),
    purchases: extractAction(item.actions, 'purchase'),
    purchase_value: extractActionValue(item.action_values, 'purchase'),
    leads: extractAction(item.actions, 'lead'),
    checkouts: extractAction(item.actions, 'initiate_checkout'),
  }))
}

async function main() {
  log('Iniciando sincronização...')

  if (!TOKEN) { log('ERRO: META_ACCESS_TOKEN não configurado em .env.local'); process.exit(1) }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { log('ERRO: NEXT_PUBLIC_SUPABASE_URL não configurado'); process.exit(1) }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { log('ERRO: SUPABASE_SERVICE_ROLE_KEY não configurado'); process.exit(1) }

  const { data: accounts, error: accError } = await supabase
    .from('client_accounts')
    .select('ad_account_id')
    .eq('is_active', true)

  if (accError) { log('ERRO ao buscar contas: ' + accError.message); process.exit(1) }
  if (!accounts?.length) { log('Nenhuma conta ativa encontrada.'); return }

  const uniqueIds = [...new Set(accounts.map(a => a.ad_account_id))]
  const from = daysAgo(30)
  const to = today()

  log(`Contas a sincronizar: ${uniqueIds.length} | Período: ${from} → ${to}`)

  let totalRows = 0
  let successCount = 0
  let errorCount = 0

  for (const adAccountId of uniqueIds) {
    try {
      log(`Sincronizando ${adAccountId}...`)
      const rows = await fetchInsights(adAccountId, from, to)

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('campaign_metrics')
          .upsert(rows, { onConflict: 'campaign_id,metric_date' })

        if (upsertError) throw new Error(upsertError.message)
      }

      await supabase.from('sync_logs').insert({
        ad_account_id: adAccountId,
        status: 'success',
        campaigns_synced: rows.length,
        date_from: from,
        date_to: to,
      })

      log(`  ✓ ${adAccountId}: ${rows.length} registros sincronizados`)
      totalRows += rows.length
      successCount++
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message
      log(`  ✗ ${adAccountId}: ${msg}`)
      await supabase.from('sync_logs').insert({
        ad_account_id: adAccountId,
        status: 'error',
        campaigns_synced: 0,
        date_from: from,
        date_to: to,
        error_message: msg,
      })
      errorCount++
    }
  }

  log(`\nConcluído: ${successCount} contas OK, ${errorCount} erros, ${totalRows} registros totais.`)
}

main().catch(err => { log('ERRO fatal: ' + err.message); process.exit(1) })
