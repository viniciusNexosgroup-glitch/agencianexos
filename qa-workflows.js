const fs = require('fs');
const path = require('path');

const root = __dirname;
const workflowDir = path.join(root, 'n8n');
const workflowFiles = fs.readdirSync(workflowDir).filter((file) => file.endsWith('.json')).sort();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const results = [];

function ok(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
}

function fail(name, detail = '') {
  results.push({ status: 'FAIL', name, detail });
}

function warn(name, detail = '') {
  results.push({ status: 'WARN', name, detail });
}

function assert(name, condition, detail = '') {
  if (condition) ok(name, detail);
  else fail(name, detail);
}

function loadWorkflow(file) {
  const fullPath = path.join(workflowDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return { file, raw, json: JSON.parse(raw) };
}

function getNode(workflow, name) {
  return workflow.json.nodes.find((node) => node.name === name);
}

function getNodeIncludes(workflow, text) {
  return workflow.json.nodes.find((node) => String(node.name || '').includes(text));
}

function envRefs(text) {
  const refs = new Set();
  for (const match of String(text).matchAll(/\$env\.([A-Z0-9_]+)/g)) refs.add(match[1]);
  return [...refs];
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function makeInput(json) {
  return {
    first: () => ({ json }),
    all: () => [{ json }],
  };
}

function makeDollar(contextByNode) {
  return function $(name) {
    const json = contextByNode[name];
    return {
      first: () => ({ json }),
      item: { json },
    };
  };
}

function compileCodeNodes(workflows) {
  for (const workflow of workflows) {
    for (const node of workflow.json.nodes || []) {
      const code = node.parameters && node.parameters.jsCode;
      if (!code) continue;
      try {
        new AsyncFunction('$input', '$env', '$', code);
        ok(`Code node compila: ${workflow.file} :: ${node.name}`);
      } catch (error) {
        fail(`Code node compila: ${workflow.file} :: ${node.name}`, error.message);
      }
    }
  }
}

function validateStructure(workflows) {
  for (const workflow of workflows) {
    assert(`JSON valido: ${workflow.file}`, Boolean(workflow.json && workflow.json.nodes));
    assert(`Workflow tem name: ${workflow.file}`, Boolean(workflow.json.name));
    assert(`Sem BOM: ${workflow.file}`, !workflow.raw.startsWith('\uFEFF'));

    const ids = new Set();
    const names = new Set();
    for (const node of workflow.json.nodes || []) {
      assert(`Node tem id/nome: ${workflow.file} :: ${node.name || node.id}`, Boolean(node.id && node.name));
      if (ids.has(node.id)) fail(`ID duplicado: ${workflow.file}`, node.id);
      ids.add(node.id);
      if (names.has(node.name)) fail(`Nome de node duplicado: ${workflow.file}`, node.name);
      names.add(node.name);
    }

    const knownNames = new Set((workflow.json.nodes || []).map((node) => node.name));
    for (const [source, conn] of Object.entries(workflow.json.connections || {})) {
      assert(`Conexao source existe: ${workflow.file} :: ${source}`, knownNames.has(source));
      const serialized = JSON.stringify(conn);
      for (const match of serialized.matchAll(/"node":"([^"]+)"/g)) {
        assert(`Conexao target existe: ${workflow.file} :: ${source} -> ${match[1]}`, knownNames.has(match[1]));
      }
    }
  }
}

function validateEnvAndSecrets(workflows) {
  const examplePath = path.join(root, '.env.local.example');
  const example = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8') : '';
  const declared = new Set([...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]));
  const allRefs = new Set();

  for (const workflow of workflows) {
    for (const ref of envRefs(workflow.raw)) allRefs.add(ref);
  }

  for (const ref of allRefs) {
    assert(`Env declarada no exemplo: ${ref}`, declared.has(ref), `.env.local.example`);
  }

  const scanFiles = [
    'README.md',
    '.env.local.example',
    'supabase/setup.sql',
    ...workflowFiles.map((file) => `n8n/${file}`),
  ];
  const secretPattern = /(cal_live_|sk-[A-Za-z0-9]|eyJ[a-zA-Z0-9_-]{20,}|[A-Za-z0-9_-]{35,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/;
  for (const file of scanFiles) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert(`Sem segredo aparente: ${file}`, !secretPattern.test(content));
  }
}

function validateStaticBusinessRules(workflows) {
  const sdr = workflows.find((workflow) => workflow.file === '03-sdr.json');
  const cal = workflows.find((workflow) => workflow.file === '04-calcom-tools.json');
  const outbound = workflows.find((workflow) => workflow.file === '02-mensagens.json');
  const followup = workflows.find((workflow) => workflow.file === '05-followup.json');

  assert('Workflow SDR existe', Boolean(sdr));
  assert('Workflow Cal.com existe', Boolean(cal));
  assert('Workflow primeira mensagem existe', Boolean(outbound));
  assert('Workflow follow-up existe', Boolean(followup));
  if (!sdr || !cal || !outbound || !followup) return;

  assert('Ferramenta remarcar_agendamento existe', Boolean(getNode(sdr, 'remarcar_agendamento')));
  assert('Ferramenta remarcar_agendamento conectada ao agente', JSON.stringify(sdr.json.connections.remarcar_agendamento || '').includes('SDR Agent'));
  assert('Subworkflow Cal.com aceita remarcar_agendamento', getNode(cal, 'Processa Acoes').parameters.jsCode.includes("acao === 'criar_agendamento' || acao === 'remarcar_agendamento'"));
  assert('Agente exige RESCHEDULE_OK antes de confirmar', getNode(sdr, 'Prepara Contexto Agente').parameters.jsCode.includes('RESCHEDULE_OK'));

  const sdrConnections = sdr.json.connections;
  assert('SDR envia mensagem antes de atualizar Supabase', JSON.stringify(sdrConnections['Aguarda Digitacao'] || '').includes('Envia Mensagem SDR'));
  assert('SDR atualiza Supabase depois do envio', JSON.stringify(sdrConnections['Envia Mensagem SDR'] || '').includes('Prepara PATCH Body'));

  const bookingNode = getNode(cal, 'Cal.com Booking');
  const versionHeader = bookingNode.parameters.headerParameters.parameters.find((param) => param.name === 'cal-api-version');
  assert('Cal.com Booking usa versao estavel 2024-08-13', versionHeader && versionHeader.value === '2024-08-13', versionHeader && versionHeader.value);

  const outboundBody = getNodeIncludes(outbound, 'Gera Mensagem').parameters.jsonBody;
  JSON.parse(outboundBody.startsWith('=') ? outboundBody.slice(1) : outboundBody);
  ok('Payload OpenAI da primeira mensagem parseia como JSON');
  assert('Primeira mensagem posiciona ecossistema', outboundBody.includes('ecossistema de captacao digital'));
  assert('Primeira mensagem nao reduz a trafego pago', !/exclusiv|somente trafego pago|s[oó] trafego pago/i.test(outboundBody));

  const followupCode = getNodeIncludes(followup, 'Gera Follow-up').parameters.jsCode;
  assert('Follow-up posiciona ecossistema', followupCode.includes('ecossistemas de captacao'));
  assert('Follow-up nao reduz a trafego pago', !/exclusiv|somente trafego pago|s[oó] trafego pago/i.test(followupCode));

  const workflowText = workflows.map((workflow) => workflow.raw).join('\n');
  const legacyProviderPattern = new RegExp(['Gr' + 'oq', 'api\\.gr' + 'oq', 'GR' + 'OQ_API_KEY'].join('|'));
  assert('Workflows nao referenciam provedor antigo quando usam OpenAI', !legacyProviderPattern.test(workflowText));
}

async function runCode(code, inputJson, contextByNode = {}, thisArg = {}) {
  const fn = new AsyncFunction('$input', '$env', '$', code);
  return await fn.call(thisArg, makeInput(inputJson), {}, makeDollar(contextByNode));
}

async function validateSdrDecisionRules(workflows) {
  const sdr = workflows.find((workflow) => workflow.file === '03-sdr.json');
  const code = getNode(sdr, 'Prepara Contexto Agente').parameters.jsCode;

  const base = {
    phone: '5531999999999',
    instance_name: 'vamo',
    pushName: 'Vinicius',
    business_name: 'Escritorio Teste',
    status: 'sent',
    isQuizLead: false,
    quizData: {},
    updated_history: [],
  };

  const onlyTraffic = await runCode(code, {
    ...base,
    new_user_message: 'Vocês mexem somente com tráfego?',
    updated_history: [{ role: 'user', content: 'Vocês mexem somente com tráfego?', ts: new Date().toISOString() }],
  });
  assert('SDR responde escopo quando lead pergunta se e so trafego', onlyTraffic[0].json.system_prompt.includes('ESCOPO_NEXOS'));

  const scheduling = await runCode(code, {
    ...base,
    new_user_message: 'amanhã de manhã',
    updated_history: [
      { role: 'assistant', content: 'Qual dia fica melhor e prefere manhã ou tarde?', ts: new Date().toISOString() },
      { role: 'user', content: 'amanhã de manhã', ts: new Date().toISOString() },
    ],
  });
  assert('SDR detecta dia + periodo para consultar agenda', scheduling[0].json.system_prompt.includes('FASE_AGENDAMENTO_DIA_E_PERIODO_RECEBIDOS'));

  const reschedule = await runCode(code, {
    ...base,
    status: 'meeting_scheduled',
    new_user_message: 'às 09:00 mesmo',
    updated_history: [
      { role: 'assistant', content: 'Sua reunião está confirmada para amanhã, 14/05/2026, às 09:30.', ts: new Date().toISOString() },
      { role: 'user', content: 'às 09:00 mesmo', ts: new Date().toISOString() },
    ],
  });
  assert('SDR detecta remarcacao com horario exato', reschedule[0].json.system_prompt.includes('REMARCACAO_COM_HORARIO'));
}

async function validateCalTools(workflows) {
  const cal = workflows.find((workflow) => workflow.file === '04-calcom-tools.json');
  const processCode = getNode(cal, 'Processa Acoes').parameters.jsCode;
  const finishCode = getNode(cal, 'Finaliza Booking').parameters.jsCode;

  const calls = [];
  const helpers = {
    httpRequest: async (options) => {
      calls.push(options);
      if (options.url.endsWith('/slots')) {
        return { data: { '2026-05-14': [{ start: '2026-05-14T12:00:00.000Z' }, { start: '2026-05-14T12:30:00.000Z' }] } };
      }
      return { status: 'success' };
    },
  };

  const slots = await runCode(processCode, {
    acao: 'verificarAgenda',
    start: '2026-05-14T03:00:00.000Z',
    end: '2026-05-14T15:00:00.000Z',
  }, {}, { helpers });
  assert('Cal.com verificarAgenda retorna horarios quando ha slots', /Horarios disponiveis/.test(slots[0].json.output));

  const rescheduleHelpers = {
    httpRequest: async (options) => {
      if (options.url.endsWith('/bookings') && options.method === 'GET') {
        return { data: [{ uid: 'old_uid', start: '2026-05-14T12:30:00.000Z' }] };
      }
      return { status: 'success' };
    },
  };
  const reschedulePrep = await runCode(processCode, {
    acao: 'remarcar_agendamento',
    start: '2026-05-14T12:00:00.000Z',
    name: 'Lead Teste',
    email: '5531999999999@nexosleads.com',
    notes: 'Resumo teste',
  }, {}, { helpers: rescheduleHelpers });
  assert('Cal.com prepara remarcacao com UID antigo', reschedulePrep[0].json._is_reschedule === true && reschedulePrep[0].json._old_booking_uid === 'old_uid');

  const finishHelpers = {
    httpRequest: async (options) => {
      if (options.url.includes('/references')) return { data: [{ type: 'google_calendar', eventUid: 'google_event_uid' }] };
      if (options.url.includes('/calendars/google/events/')) return { status: 'success' };
      if (options.url.includes('/cancel')) return { status: 'success' };
      if (options.url.includes('/leads_outbound')) return { status: 'success' };
      return { status: 'success' };
    },
  };
  const finish = await runCode(finishCode, {
    status: 'success',
    data: { uid: 'new_uid' },
  }, {
    'Processa Acoes': {
      _is_reschedule: true,
      _old_booking_uid: 'old_uid',
      _start: '2026-05-14T12:00:00.000Z',
      _name: 'Lead Teste',
      _email: '5531999999999@nexosleads.com',
      _phone: '5531999999999',
      _notes: 'Resumo teste',
    },
  }, { helpers: finishHelpers });
  assert('Finaliza Booking confirma RESCHEDULE_OK com cancelamento OK', finish[0].json.output.includes('RESCHEDULE_OK'));
  assert('Finaliza Booking atualiza descricao Google Calendar', finish[0].json.output.includes('CALENDAR_DESC_OK'));
}

async function main() {
  const workflows = workflowFiles.map(loadWorkflow);

  assert('Quantidade de workflows n8n', workflows.length === 5, `${workflows.length} encontrados`);
  validateStructure(workflows);
  compileCodeNodes(workflows);
  validateEnvAndSecrets(workflows);
  validateStaticBusinessRules(workflows);
  await validateSdrDecisionRules(workflows);
  await validateCalTools(workflows);

  const failed = results.filter((result) => result.status === 'FAIL');
  const warned = results.filter((result) => result.status === 'WARN');
  const passed = results.filter((result) => result.status === 'PASS');

  for (const result of results) {
    const suffix = result.detail ? ` - ${result.detail}` : '';
    console.log(`[${result.status}] ${result.name}${suffix}`);
  }
  console.log('');
  console.log(`Resumo QA: ${passed.length} pass, ${failed.length} fail, ${warned.length} warn`);

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error('[FAIL] Erro inesperado no QA:', error.stack || error.message);
  process.exit(1);
});
