/**
 * QA Test Suite — CRM
 * Uso: QA_PASSWORD=suasenha node scripts/qa-crm.mjs
 *
 * Variáveis de ambiente:
 *   QA_EMAIL    (padrão: viniguisan@gmail.com)
 *   QA_PASSWORD (obrigatório)
 *   QA_URL      (padrão: https://dashboard.viniciusguilherme.shop)
 */

const BASE   = process.env.QA_URL      || 'https://dashboard.viniciusguilherme.shop'
const EMAIL  = process.env.QA_EMAIL    || 'viniguisan@gmail.com'
const PASS   = process.env.QA_PASSWORD || ''

// ─── Utilitários ──────────────────────────────────────────────────────────────

let cookie = ''
let passed = 0
let failed = 0
const failures = []

function log(icon, label, detail = '') {
  const d = detail ? `  →  ${detail}` : ''
  console.log(`  ${icon}  ${label}${d}`)
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
  const res = await fetch(`${BASE}${path}`, opts)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { status: res.status, ok: res.ok, json, headers: res.headers }
}

function assert(label, condition, detail = '') {
  if (condition) {
    passed++
    log('✅', label, detail)
  } else {
    failed++
    failures.push({ label, detail })
    log('❌', label, detail)
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

// ─── Autenticação ─────────────────────────────────────────────────────────────

async function login() {
  section('AUTH — Login')
  if (!PASS) {
    console.error('\n  ⚠️  Defina QA_PASSWORD=suasenha antes de rodar.\n')
    process.exit(1)
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const json = await res.json()
  assert('POST /api/auth/login → 200', res.ok, `status=${res.status}`)
  assert('Resposta tem ok:true', json.ok === true)
  assert('Resposta tem user.email', json.user?.email === EMAIL)

  const setCookie = res.headers.get('set-cookie')
  assert('Cookie de sessão definido', !!setCookie)
  if (setCookie) cookie = setCookie.split(';')[0]
  return res.ok
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

async function testTags() {
  section('TAGS — CRUD completo')
  let tagId = null

  // GET lista
  const list = await api('GET', '/api/whatsapp/tags')
  assert('GET /api/whatsapp/tags → 200', list.ok, `status=${list.status}`)
  assert('Resposta tem array tags', Array.isArray(list.json.tags))

  // POST criar
  const created = await api('POST', '/api/whatsapp/tags', { name: '[QA] Tag Teste', color: '#ff0000' })
  assert('POST /api/whatsapp/tags → 201', created.status === 201, `status=${created.status}`)
  assert('Tag criada tem id', !!created.json.tag?.id)
  assert('Tag criada tem nome correto', created.json.tag?.name === '[QA] Tag Teste')
  tagId = created.json.tag?.id

  // POST sem nome (deve falhar)
  const noName = await api('POST', '/api/whatsapp/tags', { color: '#ff0000' })
  assert('POST sem name → 400', noName.status === 400, `status=${noName.status}`)

  // DELETE
  if (tagId) {
    const del = await api('DELETE', `/api/whatsapp/tags?id=${tagId}`)
    assert('DELETE /api/whatsapp/tags → 200', del.ok, `status=${del.status}`)
    // Confirmar que sumiu da lista
    const listAfter = await api('GET', '/api/whatsapp/tags')
    const still = listAfter.json.tags?.some(t => t.id === tagId)
    assert('Tag removida não aparece mais na lista', !still)
  }
  return { tagId }
}

// ─── Contatos ─────────────────────────────────────────────────────────────────

async function testContacts() {
  section('CONTACTS — Listagem e busca')

  const list = await api('GET', '/api/whatsapp/contacts')
  assert('GET /api/whatsapp/contacts → 200', list.ok, `status=${list.status}`)

  const contacts = list.json.contacts ?? list.json ?? []
  assert('Lista de contatos é array', Array.isArray(contacts))

  const firstContact = contacts[0]
  if (firstContact) {
    assert('Contato tem id', !!firstContact.id)
    assert('Contato tem name', typeof firstContact.name === 'string')
    assert('Contato tem phone', typeof firstContact.phone === 'string')
    log('ℹ️', `Usando contato de teste: "${firstContact.name}" (${firstContact.phone})`)
  } else {
    log('⚠️', 'Nenhum contato encontrado — pulando testes dependentes de contato')
  }
  return { contacts, firstContact }
}

// ─── Tags de Contato ──────────────────────────────────────────────────────────

async function testContactTags(firstContact) {
  section('CONTACT TAGS — Atribuir / Listar / Remover')

  // Cria uma tag temporária para os testes
  const tagRes = await api('POST', '/api/whatsapp/tags', { name: '[QA] Tag Contato', color: '#00ff00' })
  const tempTag = tagRes.json.tag
  if (!tempTag) { log('⚠️', 'Não foi possível criar tag temporária — pulando'); return }

  // GET todas as contact-tags (rota server-side com service role)
  const all = await api('GET', '/api/whatsapp/contact-tags')
  assert('GET /api/whatsapp/contact-tags → 200', all.ok, `status=${all.status}`)
  assert('Resposta tem contactTags object', typeof all.json.contactTags === 'object')

  if (firstContact) {
    const cid = firstContact.id

    // GET tags do contato específico
    const ctags = await api('GET', `/api/whatsapp/contacts/${cid}/tags`)
    assert(`GET /contacts/${cid}/tags → 200`, ctags.ok, `status=${ctags.status}`)
    assert('Resposta tem array tags', Array.isArray(ctags.json.tags))

    // POST atribuir tag ao contato
    const assign = await api('POST', `/api/whatsapp/contacts/${cid}/tags`, { tag_id: tempTag.id })
    assert(`POST atribuir tag ao contato → 201`, assign.status === 201, `status=${assign.status}`)

    // Confirmar que tag está na lista do contato
    const check = await api('GET', `/api/whatsapp/contacts/${cid}/tags`)
    const hasTag = check.json.tags?.some(t => t.id === tempTag.id)
    assert('Tag aparece na lista do contato após atribuição', hasTag)

    // POST atribuir mesma tag novamente (idempotente)
    const dupe = await api('POST', `/api/whatsapp/contacts/${cid}/tags`, { tag_id: tempTag.id })
    assert('POST duplicado não causa erro (upsert idempotente)', dupe.status === 201 || dupe.ok)

    // DELETE remover tag do contato via query param (correção recente)
    const remove = await api('DELETE', `/api/whatsapp/contacts/${cid}/tags?tag_id=${tempTag.id}`)
    assert(`DELETE /contacts/${cid}/tags?tag_id=... → 200`, remove.ok, `status=${remove.status}`)

    // Confirmar que tag sumiu
    const checkAfter = await api('GET', `/api/whatsapp/contacts/${cid}/tags`)
    const stillHas = checkAfter.json.tags?.some(t => t.id === tempTag.id)
    assert('Tag removida não aparece mais na lista do contato', !stillHas)

    // DELETE sem tag_id (deve retornar 400)
    const badDel = await api('DELETE', `/api/whatsapp/contacts/${cid}/tags`)
    assert('DELETE sem tag_id → 400', badDel.status === 400, `status=${badDel.status}`)
  }

  // Limpa a tag temporária
  await api('DELETE', `/api/whatsapp/tags?id=${tempTag.id}`)
}

// ─── Respostas Rápidas ────────────────────────────────────────────────────────

async function testQuickReplies() {
  section('QUICK REPLIES — CRUD completo')
  let qrId = null

  const list = await api('GET', '/api/whatsapp/quick-replies')
  assert('GET /api/whatsapp/quick-replies → 200', list.ok, `status=${list.status}`)
  assert('Resposta tem quickReplies array', Array.isArray(list.json.quickReplies))

  // POST criar
  const created = await api('POST', '/api/whatsapp/quick-replies', {
    shortcut: '/qa-teste',
    content: 'Olá! Esta é uma mensagem de teste do QA.',
    type: 'text',
  })
  assert('POST criar quick reply → 201', created.status === 201, `status=${created.status}`)
  assert('Quick reply tem id', !!created.json.quickReply?.id)
  assert('Shortcut correto', created.json.quickReply?.shortcut === '/qa-teste')
  qrId = created.json.quickReply?.id

  // POST sem shortcut (deve falhar)
  const noShortcut = await api('POST', '/api/whatsapp/quick-replies', { content: 'teste' })
  assert('POST sem shortcut → 400', noShortcut.status === 400, `status=${noShortcut.status}`)

  // POST sem content (deve falhar)
  const noContent = await api('POST', '/api/whatsapp/quick-replies', { shortcut: '/x' })
  assert('POST sem content → 400', noContent.status === 400, `status=${noContent.status}`)

  // DELETE
  if (qrId) {
    const del = await api('DELETE', `/api/whatsapp/quick-replies?id=${qrId}`)
    assert('DELETE quick reply → 200', del.ok, `status=${del.status}`)
  }

  // DELETE sem id (deve falhar)
  const noId = await api('DELETE', '/api/whatsapp/quick-replies')
  assert('DELETE sem id → 400', noId.status === 400, `status=${noId.status}`)
}

// ─── Departamentos ────────────────────────────────────────────────────────────

async function testDepartments() {
  section('DEPARTMENTS — CRUD completo')
  let deptId = null

  const list = await api('GET', '/api/whatsapp/departments')
  assert('GET /api/whatsapp/departments → 200', list.ok, `status=${list.status}`)
  assert('Resposta tem departments array', Array.isArray(list.json.departments))

  // POST criar
  const created = await api('POST', '/api/whatsapp/departments', { name: '[QA] Depto Teste' })
  assert('POST criar departamento → 200', created.ok, `status=${created.status}`)
  assert('Departamento tem id', !!created.json.department?.id)
  deptId = created.json.department?.id

  // POST sem nome (deve falhar)
  const noName = await api('POST', '/api/whatsapp/departments', {})
  assert('POST sem nome → 400', noName.status === 400, `status=${noName.status}`)

  // PATCH renomear
  if (deptId) {
    const rename = await api('PATCH', '/api/whatsapp/departments', { id: deptId, name: '[QA] Depto Renomeado' })
    assert('PATCH renomear departamento → 200', rename.ok, `status=${rename.status}`)
  }

  // DELETE
  if (deptId) {
    const del = await api('DELETE', `/api/whatsapp/departments?id=${deptId}`)
    assert('DELETE departamento → 200', del.ok, `status=${del.status}`)
  }
}

// ─── Funis e Kanban ───────────────────────────────────────────────────────────

async function testFunnelsAndLeads(firstContact) {
  section('FUNNELS + LEADS — CRUD completo')
  let funnelId = null, stageId = null, leadId = null, found = null

  // GET funnels
  const list = await api('GET', '/api/whatsapp/funnels')
  assert('GET /api/whatsapp/funnels → 200', list.ok, `status=${list.status}`)
  assert('Resposta tem funnels array', Array.isArray(list.json.funnels))

  // POST criar funil com etapas
  const created = await api('POST', '/api/whatsapp/funnels', {
    name: '[QA] Funil Teste',
    stages: ['Lead', 'Qualificado', 'Proposta', 'Fechado'],
  })
  assert('POST criar funil → 200', created.ok, `status=${created.status}`)
  assert('Funil tem id', !!created.json.funnel?.id)
  funnelId = created.json.funnel?.id

  // GET para confirmar criação
  if (funnelId) {
    const check = await api('GET', '/api/whatsapp/funnels')
    found = check.json.funnels?.find(f => f.id === funnelId)
    assert('Funil aparece na listagem', !!found)
    assert('Funil tem etapas criadas', (found?.crm_stages?.length ?? 0) === 4)
    stageId = found?.crm_stages?.[0]?.id
  }

  // POST criar lead
  if (firstContact && stageId && funnelId) {
    const lead = await api('POST', '/api/whatsapp/leads', {
      contactId: firstContact.id,
      stageId,
      funnelId,
      title: '[QA] Lead Teste',
      notes: 'Criado pelo script de QA',
      value: 1500,
    })
    assert('POST criar lead → 200', lead.ok, `status=${lead.status}`)
    assert('Lead tem id', !!lead.json.lead?.id)
    leadId = lead.json.lead?.id

    // GET leads do funil
    const leads = await api('GET', `/api/whatsapp/leads?funnel_id=${funnelId}`)
    assert('GET leads por funil → 200', leads.ok)
    const myLead = leads.json.leads?.find(l => l.id === leadId)
    assert('Lead aparece na listagem do funil', !!myLead)

    // GET lead por contact_id
    const byContact = await api('GET', `/api/whatsapp/leads?contact_id=${firstContact.id}`)
    assert('GET lead por contact_id → 200', byContact.ok)

    // PATCH mover lead de etapa
    if (found?.crm_stages?.[1]?.id) {
      const move = await api('PATCH', '/api/whatsapp/leads', {
        id: leadId,
        stageId: found.crm_stages[1].id,
      })
      assert('PATCH mover lead de etapa → 200', move.ok, `status=${move.status}`)
    }

    // PATCH atualizar notes e value
    const update = await api('PATCH', '/api/whatsapp/leads', {
      id: leadId,
      notes: 'Atualizado pelo QA',
      value: 2000,
      title: '[QA] Lead Atualizado',
    })
    assert('PATCH atualizar notes/value → 200', update.ok)

    // DELETE lead
    if (leadId) {
      const del = await api('DELETE', `/api/whatsapp/leads?id=${leadId}`)
      assert('DELETE lead → 200', del.ok, `status=${del.status}`)
    }
  } else {
    log('⚠️', 'Sem contato/stage disponível — testes de lead pulados')
  }

  return { funnelId }
}

// ─── Mensagens Agendadas ──────────────────────────────────────────────────────

async function testScheduled(firstContact, instances) {
  section('SCHEDULED MESSAGES — POST / GET / DELETE')

  if (!firstContact) { log('⚠️', 'Sem contato — pulando'); return }
  const instanceName = instances?.[0]?.instance_name
  if (!instanceName) { log('⚠️', 'Sem instância — pulando'); return }

  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h

  // POST criar mensagem agendada
  const created = await api('POST', '/api/whatsapp/scheduled', {
    contact_id: firstContact.id,
    instance_name: instanceName,
    body: '[QA] Mensagem agendada de teste',
    send_at: futureDate,
  })
  assert('POST criar scheduled → 201', created.status === 201, `status=${created.status}`)
  assert('Scheduled tem id', !!created.json.scheduled?.id)
  const schedId = created.json.scheduled?.id

  // POST com data no passado (deve falhar)
  const past = await api('POST', '/api/whatsapp/scheduled', {
    contact_id: firstContact.id,
    instance_name: instanceName,
    body: 'teste',
    send_at: new Date(Date.now() - 1000).toISOString(),
  })
  assert('POST com data no passado → 400', past.status === 400, `status=${past.status}`)

  // GET mensagens agendadas do contato
  if (schedId) {
    const list = await api('GET', `/api/whatsapp/scheduled?contact_id=${firstContact.id}`)
    assert('GET scheduled por contact_id → 200', list.ok)
    const found = list.json.scheduled?.find(s => s.id === schedId)
    assert('Mensagem agendada aparece na listagem', !!found)

    // DELETE cancelar
    const del = await api('DELETE', `/api/whatsapp/scheduled?id=${schedId}`)
    assert('DELETE (cancelar) scheduled → 200', del.ok, `status=${del.status}`)
  }
}

// ─── Instâncias ───────────────────────────────────────────────────────────────

async function testInstances() {
  section('INSTANCES — Listagem')

  const list = await api('GET', '/api/whatsapp/instance')
  assert('GET /api/whatsapp/instance → 200', list.ok, `status=${list.status}`)

  const instances = list.json.instances ?? list.json ?? []
  assert('Resposta é array', Array.isArray(instances))

  if (instances.length > 0) {
    const inst = instances[0]
    assert('Instância tem instance_name', !!inst.instance_name)
    log('ℹ️', `Instâncias encontradas: ${instances.map(i => i.instance_name).join(', ')}`)
  } else {
    log('⚠️', 'Nenhuma instância cadastrada')
  }
  return instances
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

async function testMessages(firstContact) {
  section('MESSAGES — Paginação')
  if (!firstContact) { log('⚠️', 'Sem contato — pulando'); return }

  const msgs = await api('GET', `/api/whatsapp/messages?contact_id=${firstContact.id}`)
  assert('GET /api/whatsapp/messages → 200', msgs.ok, `status=${msgs.status}`)
  assert('Resposta tem messages array', Array.isArray(msgs.json.messages))
  assert('Resposta tem has_more bool', typeof msgs.json.has_more === 'boolean')

  const count = msgs.json.messages?.length ?? 0
  log('ℹ️', `Mensagens retornadas: ${count} (has_more=${msgs.json.has_more})`)

  // Paginação: ?before=<timestamp mais antigo>
  if (count > 0) {
    const oldest = msgs.json.messages[0]
    const paged = await api('GET', `/api/whatsapp/messages?contact_id=${firstContact.id}&before=${oldest.timestamp}`)
    assert('GET com ?before= → 200', paged.ok, `status=${paged.status}`)
    if (paged.ok) {
      assert('Mensagens de paginação são mais antigas', paged.json.messages?.every(
        m => m.timestamp < oldest.timestamp
      ) ?? true)
    }
  }
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

async function testBroadcast() {
  section('BROADCAST — Criação e exclusão')

  const list = await api('GET', '/api/whatsapp/broadcast')
  assert('GET /api/whatsapp/broadcast → 200', list.ok, `status=${list.status}`)
  assert('Resposta tem campaigns array', Array.isArray(list.json.campaigns ?? list.json))

  // POST criar campanha (draft — não dispara envio)
  const instances = await api('GET', '/api/whatsapp/instance')
  const instanceName = (instances.json.instances ?? instances.json)?.[0]?.instance_name
  if (!instanceName) { log('⚠️', 'Sem instância — pulando criação de campanha'); return }

  const created = await api('POST', '/api/whatsapp/broadcast', {
    name: '[QA] Campanha Teste',
    instance_name: instanceName,
    body: 'Olá {{nome}}, tudo bem? (teste QA)',
  })
  assert('POST criar broadcast → 2xx', created.ok || created.status === 201, `status=${created.status}`)
  const campId = created.json.campaign?.id ?? created.json.id

  // DELETE se criou
  if (campId) {
    const del = await api('DELETE', `/api/whatsapp/broadcast/${campId}`)
    assert('DELETE broadcast → 200', del.ok, `status=${del.status}`)
  }
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

async function testCustomFields(firstContact) {
  section('CUSTOM FIELDS — Definições e valores')
  let fieldId = null

  // GET definições
  const defs = await api('GET', '/api/whatsapp/custom-fields')
  assert('GET /api/whatsapp/custom-fields → 200', defs.ok, `status=${defs.status}`)

  // POST criar definição
  const created = await api('POST', '/api/whatsapp/custom-fields', {
    name: '[QA] Campo Teste',
    field_type: 'text',
  })
  assert('POST criar custom field → 2xx', created.ok || created.status === 201, `status=${created.status}`)
  fieldId = created.json.field?.id ?? created.json.id

  if (fieldId && firstContact) {
    // GET valores do contato
    const vals = await api('GET', `/api/whatsapp/contacts/${firstContact.id}/custom-fields`)
    assert(`GET custom fields do contato → 200`, vals.ok, `status=${vals.status}`)

    // PATCH salvar valor
    const patch = await api('PATCH', `/api/whatsapp/contacts/${firstContact.id}/custom-fields`, {
      field_id: fieldId,
      value: 'Valor QA',
    })
    assert('PATCH salvar valor de custom field → 200', patch.ok, `status=${patch.status}`)
  }

  // DELETE definição
  if (fieldId) {
    const del = await api('DELETE', `/api/whatsapp/custom-fields?id=${fieldId}`)
    assert('DELETE custom field → 200', del.ok, `status=${del.status}`)
  }
}

// ─── Flows ────────────────────────────────────────────────────────────────────

async function testFlows() {
  section('FLOWS — CRUD básico')
  let flowId = null

  const list = await api('GET', '/api/whatsapp/flows')
  assert('GET /api/whatsapp/flows → 200', list.ok, `status=${list.status}`)

  const instancesRes = await api('GET', '/api/whatsapp/instance')
  const instanceName = (instancesRes.json.instances ?? instancesRes.json)?.[0]?.instance_name ?? ''

  const created = await api('POST', '/api/whatsapp/flows', {
    name: '[QA] Flow Teste',
    trigger_type: 'keyword',
    trigger_value: 'qa_test_keyword',
    instance_name: instanceName,
  })
  assert('POST criar flow → 2xx', created.ok || created.status === 201, `status=${created.status}`)
  flowId = created.json.flow?.id

  if (flowId) {
    // GET flow específico
    const single = await api('GET', `/api/whatsapp/flows/${flowId}`)
    assert(`GET flow por id → 200`, single.ok, `status=${single.status}`)

    // DELETE
    const del = await api('DELETE', `/api/whatsapp/flows?id=${flowId}`)
    assert('DELETE flow → 200', del.ok, `status=${del.status}`)
  }
}

// ─── Auth sem sessão (proteção de rotas) ──────────────────────────────────────

async function testAuthProtection() {
  section('AUTH PROTECTION — Rotas protegidas sem cookie')
  const savedCookie = cookie
  cookie = '' // remove sessão

  const routes = [
    '/api/whatsapp/tags',
    '/api/whatsapp/contacts',
    '/api/whatsapp/leads',
    '/api/whatsapp/funnels',
    '/api/whatsapp/quick-replies',
    '/api/whatsapp/departments',
    '/api/whatsapp/broadcast',
    '/api/whatsapp/custom-fields',
    '/api/whatsapp/flows',
    '/api/whatsapp/contact-tags',
  ]

  for (const route of routes) {
    const res = await api('GET', route)
    assert(`${route} sem sessão → 401`, res.status === 401, `status=${res.status}`)
  }

  cookie = savedCookie // restaura sessão
}

// ─── Cleanup: remove funil de teste (se necessário) ──────────────────────────

async function cleanup(funnelId) {
  if (!funnelId) return
  section('CLEANUP — Removendo dados de teste residuais')
  // O funil de QA não tem rota DELETE exposta, mas stages e leads já foram removidos.
  // Vamos tentar deletar via funnels se existir essa rota
  const res = await api('DELETE', `/api/whatsapp/funnels?id=${funnelId}`)
  if (res.ok) {
    log('✅', `Funil [QA] removido (id=${funnelId})`)
  } else {
    log('ℹ️', `Funil [QA] (id=${funnelId}) pode precisar de remoção manual`)
  }
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function run() {
  console.log('\n' + '═'.repeat(60))
  console.log('  🧪  QA TEST SUITE — CRM')
  console.log(`  URL: ${BASE}`)
  console.log(`  Usuário: ${EMAIL}`)
  console.log('═'.repeat(60))

  const ok = await login()
  if (!ok) { console.error('\n  Falha no login — abortando.\n'); process.exit(1) }

  await testAuthProtection()

  const instances           = await testInstances()
  const { contacts, firstContact } = await testContacts()

  await testTags()
  await testContactTags(firstContact)
  await testQuickReplies()
  await testDepartments()
  const { funnelId }        = await testFunnelsAndLeads(firstContact)
  await testScheduled(firstContact, instances)
  await testMessages(firstContact)
  await testBroadcast()
  await testCustomFields(firstContact)
  await testFlows()

  await cleanup(funnelId)

  // ─── Relatório Final ───────────────────────────────────────────────────────
  const total = passed + failed
  console.log('\n' + '═'.repeat(60))
  console.log('  📊  RESULTADO FINAL')
  console.log('═'.repeat(60))
  console.log(`  Total:   ${total}`)
  console.log(`  ✅ Passou: ${passed}`)
  console.log(`  ❌ Falhou: ${failed}`)

  if (failures.length > 0) {
    console.log('\n  Falhas:')
    for (const f of failures) {
      console.log(`    ❌  ${f.label}${f.detail ? '  →  ' + f.detail : ''}`)
    }
  }
  console.log('═'.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => { console.error(err); process.exit(1) })
