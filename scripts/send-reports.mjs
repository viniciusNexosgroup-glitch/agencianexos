/**
 * send-reports.mjs — Disparador de relatórios via WhatsApp
 *
 * Uso:
 *   node scripts/send-reports.mjs --from 2026-04-01 --to 2026-04-30
 *   node scripts/send-reports.mjs --from 2026-04-01 --to 2026-04-30 --account "Unique BM 02"
 *
 * Requer arquivo .reports.env na raiz do projeto (ver instruções abaixo).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Carrega variáveis de ambiente ────────────────────────────────────────────
function loadEnv() {
  const env = {}
  for (const file of ['.reports.env', '.env.local', '.env']) {
    const p = resolve(ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
  }
  return { ...env, ...process.env }
}

const ENV = loadEnv()
const SUPABASE_URL  = ENV.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = ENV.SUPABASE_SERVICE_ROLE_KEY
const EVOLUTION_URL = ENV.EVOLUTION_API_URL
const EVOLUTION_KEY = ENV.EVOLUTION_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !EVOLUTION_URL || !EVOLUTION_KEY) {
  console.error(`
❌ Variáveis faltando. Crie o arquivo .reports.env na raiz do projeto:

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
EVOLUTION_API_URL=https://evolution.seudominio.com
EVOLUTION_API_KEY=sua-chave-aqui
`)
  process.exit(1)
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const get  = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const FROM           = get('--from') || get('-f')
const TO             = get('--to')   || get('-t')
const ACCOUNT_FILTER = get('--account') || get('-a')  // nome ou null = todos

if (!FROM || !TO) {
  console.error('Uso: node scripts/send-reports.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--account "Nome"]')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Funções auxiliares ───────────────────────────────────────────────────────
const fmt  = n  => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtN = n  => Number(n || 0).toLocaleString('pt-BR')
const fmtD = dt => {
  const [y, m, d] = dt.split('-')
  return `${d}/${m}/${y}`
}

async function fetchMetaData(adAccountId) {
  const { data: rows } = await db
    .from('campaign_metrics')
    .select('campaign_name,spend,reach,clicks,impressions,conversations,leads,purchases,profile_visits')
    .eq('ad_account_id', adAccountId)
    .gte('metric_date', FROM)
    .lte('metric_date', TO)

  if (!rows || rows.length === 0) return null

  // Agrega por campanha
  const campMap = {}
  for (const r of rows) {
    const k = r.campaign_name
    if (!campMap[k]) campMap[k] = { campaign_name: k, spend: 0, reach: 0, clicks: 0, impressions: 0, resultado: 0 }
    campMap[k].spend       += Number(r.spend || 0)
    campMap[k].reach       += Number(r.reach || 0)
    campMap[k].clicks      += Number(r.clicks || 0)
    campMap[k].impressions += Number(r.impressions || 0)
    const res = Number(r.conversations || 0) || Number(r.leads || 0) || Number(r.purchases || 0) || Number(r.profile_visits || 0)
    campMap[k].resultado   += res
  }

  const campaigns = Object.values(campMap).sort((a, b) => b.spend - a.spend)
  const totals    = campaigns.reduce((acc, c) => ({
    spend:       acc.spend       + c.spend,
    reach:       acc.reach       + c.reach,
    clicks:      acc.clicks      + c.clicks,
    impressions: acc.impressions + c.impressions,
    resultado:   acc.resultado   + c.resultado,
  }), { spend: 0, reach: 0, clicks: 0, impressions: 0, resultado: 0 })

  const ctr             = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const custoResultado  = totals.resultado   > 0 ? totals.spend / totals.resultado : null

  return { totals: { ...totals, ctr, custoResultado }, campaigns }
}

function buildMessage(accountName, meta) {
  const lines = []
  lines.push(`📊 *Relatório de Anúncios*`)
  lines.push(`📅 ${fmtD(FROM)} → ${fmtD(TO)}`)
  lines.push(`🏢 ${accountName}`)
  lines.push(``)

  if (meta) {
    lines.push(`━━━━━━━━━━━━━━━━━━`)
    lines.push(`*META ADS*`)
    lines.push(`━━━━━━━━━━━━━━━━━━`)
    lines.push(`💰 Investido: R$ ${fmt(meta.totals.spend)}`)
    lines.push(`👁️ Impressões: ${fmtN(meta.totals.impressions)}`)
    lines.push(`🤝 Alcance: ${fmtN(meta.totals.reach)}`)
    lines.push(`🖱️ Cliques: ${fmtN(meta.totals.clicks)}`)
    lines.push(`📊 CTR: ${fmt(meta.totals.ctr)}%`)
    lines.push(`🎯 Resultados: ${fmtN(meta.totals.resultado)}`)
    if (meta.totals.custoResultado !== null) {
      lines.push(`💵 Custo/Resultado: R$ ${fmt(meta.totals.custoResultado)}`)
    }
    lines.push(``)

    if (meta.campaigns.length > 0) {
      lines.push(`*Campanhas:*`)
      for (const c of meta.campaigns.slice(0, 10)) {
        lines.push(`▸ ${c.campaign_name}`)
        lines.push(`   R$ ${fmt(c.spend)} | ${fmtN(c.clicks)} cliques | ${fmtN(c.resultado)} res.`)
      }
    }
  } else {
    lines.push(`_Nenhum dado de Meta Ads no período._`)
  }

  lines.push(``)
  lines.push(`_Gerado em ${new Date().toLocaleString('pt-BR')}_`)
  return lines.join('\n')
}

async function sendWhatsApp(instanceName, groupJid, text) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number: groupJid, text }),
  })
  return res.ok
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📤 Disparando relatórios: ${fmtD(FROM)} → ${fmtD(TO)}`)
  if (ACCOUNT_FILTER) console.log(`   Conta: ${ACCOUNT_FILTER}`)
  console.log()

  let q = db.from('client_accounts')
    .select('ad_account_id, account_name, report_group_jid, report_instance_name')
    .not('report_group_jid', 'is', null)
    .not('report_instance_name', 'is', null)

  if (ACCOUNT_FILTER) {
    q = q.ilike('account_name', `%${ACCOUNT_FILTER}%`)
  }

  const { data: accounts, error } = await q
  if (error) { console.error('❌ Erro ao buscar contas:', error.message); process.exit(1) }
  if (!accounts || accounts.length === 0) {
    console.log('⚠️  Nenhuma conta com grupo vinculado encontrada.')
    if (ACCOUNT_FILTER) console.log(`   Verifique se o nome "${ACCOUNT_FILTER}" está correto.`)
    process.exit(0)
  }

  console.log(`📋 ${accounts.length} conta(s) com grupo vinculado:\n`)

  let ok = 0, fail = 0
  for (const acc of accounts) {
    process.stdout.write(`  → ${acc.account_name}... `)

    const meta    = await fetchMetaData(acc.ad_account_id)
    const message = buildMessage(acc.account_name, meta)
    const sent    = await sendWhatsApp(acc.report_instance_name, acc.report_group_jid, message)

    if (sent) { console.log('✅ enviado'); ok++ }
    else       { console.log('❌ falhou'); fail++ }
  }

  console.log(`\n✅ ${ok} enviado(s)  ❌ ${fail} falhou(ram)\n`)
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
