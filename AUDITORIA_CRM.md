# Auditoria Técnica — CRM WhatsApp
**Data:** 22/04/2026  
**Escopo:** Frontend, APIs/Webhook, Banco de Dados (Supabase)

---

## Resumo Executivo

| Severidade | Frontend | APIs | Banco | Total |
|---|---|---|---|---|
| 🔴 CRÍTICO | 5 | 7 | 5 | **17** |
| 🟠 ALTO | 6 | 9 | 4 | **19** |
| 🟡 MÉDIO | 10 | 6 | 3 | **19** |
| 🟢 BAIXO | 2 | 0 | 2 | **4** |

---

## 🔴 CRÍTICOS — Corrigir Hoje

### [BD-1] Colunas faltantes no banco causam falhas silenciosas
**Impacto:** QR code não persiste, mensagens de grupo perdem remetente, valor dos leads some.

Execute no Supabase SQL Editor:
```sql
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS qr_base64 TEXT;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS participant_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_jid TEXT;

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 0;
```

---

### [BD-2] RLS completamente ausente nas tabelas WhatsApp
**Arquivo:** `supabase_crm_tables.sql` — todas as tabelas com `DISABLE ROW LEVEL SECURITY`  
**Impacto:** Qualquer usuário autenticado acessa dados de todos os outros clientes. Violação de privacidade.

```sql
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_funnels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads          ENABLE ROW LEVEL SECURITY;

-- Política: admin vê tudo, usuário vê só seus dados
CREATE POLICY "admin_all_instances" ON whatsapp_instances
  FOR ALL USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_all_contacts" ON whatsapp_contacts
  FOR ALL USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_all_messages" ON whatsapp_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_all_leads" ON crm_leads
  FOR ALL USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
```

---

### [BD-3] Webhook sem transação — dados inconsistentes
**Arquivo:** `src/lib/webhook-handler.ts` linhas 69–118  
**Impacto:** Se falhar entre inserir contato e inserir mensagem, dados ficam pela metade sem rollback.

Criar função atômica no Supabase:
```sql
CREATE OR REPLACE FUNCTION process_whatsapp_message(
  p_instance_name TEXT, p_phone TEXT, p_message_id TEXT,
  p_contact_name TEXT, p_remote_jid TEXT, p_body TEXT,
  p_from_me BOOLEAN, p_timestamp TIMESTAMPTZ, p_message_type TEXT,
  p_participant_name TEXT DEFAULT NULL, p_participant_jid TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_contact_id UUID;
BEGIN
  INSERT INTO whatsapp_contacts (instance_name, phone, name, remote_jid, last_message_at)
  VALUES (p_instance_name, p_phone, p_contact_name, p_remote_jid, p_timestamp)
  ON CONFLICT (instance_name, phone) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, whatsapp_contacts.name),
      last_message_at = GREATEST(whatsapp_contacts.last_message_at, EXCLUDED.last_message_at)
  RETURNING id INTO v_contact_id;

  INSERT INTO whatsapp_messages (
    contact_id, instance_name, message_id, from_me, body,
    message_type, timestamp, participant_name, participant_jid
  ) VALUES (
    v_contact_id, p_instance_name, p_message_id, p_from_me, p_body,
    p_message_type, p_timestamp, p_participant_name, p_participant_jid
  )
  ON CONFLICT (message_id) DO UPDATE
  SET participant_name = COALESCE(EXCLUDED.participant_name, whatsapp_messages.participant_name),
      participant_jid  = COALESCE(EXCLUDED.participant_jid,  whatsapp_messages.participant_jid);

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;
```

---

### [API-1] Webhook sem verificação de assinatura
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`  
**Impacto:** Qualquer pessoa pode enviar webhooks falsos e injetar dados no banco.

```typescript
// Adicionar no início do POST handler:
const secret = process.env.WEBHOOK_SECRET
if (secret) {
  const signature = req.headers.get('x-webhook-secret')
  if (signature !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

---

### [API-2] Sem autorização de propriedade em DELETE/PATCH de leads
**Arquivo:** `src/app/api/whatsapp/leads/route.ts` linhas 58–82  
**Impacto:** Usuário autenticado pode deletar leads de qualquer outro usuário sabendo o UUID.

```typescript
// Antes de deletar, verificar propriedade:
const { data: lead } = await supabase().from('crm_leads').select('funnel_id').eq('id', id).single()
const { data: funnel } = await supabase().from('crm_funnels').select('created_by').eq('id', lead?.funnel_id).single()
if (!funnel || (funnel.created_by !== session.userId && !session.isAdmin)) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
}
```

---

### [API-3] JWT_SECRET derivado de chave sensível
**Arquivo:** `src/lib/session.ts`  
**Impacto:** Chave JWT gerada dos primeiros 32 chars da service role key + zeros — previsível e insegura.

Adicione no `.env`:
```
JWT_SECRET=gere-uma-chave-aleatoria-de-32-chars-aqui
```
E atualize `session.ts` para usar `process.env.JWT_SECRET`.

---

### [API-4] Webhook retorna sucesso mas processamento pode falhar
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`  
**Impacto:** Evolution API recebe `200 OK`, não tenta reenviar, e a mensagem é perdida.

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    await processWebhookEvent(body)
  } catch (err) {
    console.error('Webhook processing failed:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

---

### [FRONT-1] Envio de mensagem trava UI se rede cair
**Arquivo:** `src/components/crm/ChatPanel.tsx` linhas 103–137  
**Impacto:** Se a requisição travar (sem resposta), `setSending(false)` nunca é chamado e o botão fica bloqueado.

```typescript
// Envolver o fetch em try/finally:
try {
  const res = await fetch('/api/whatsapp/send', { ... })
  const result = await res.json()
  if (result.error) throw new Error(result.error)
  setText('')
  setTimeout(load, 1500)
} catch (err) {
  setError(String(err))
  setMessages(prev => prev.filter(m => m.id !== optimistic.id))
} finally {
  setSending(false)
}
```

---

## 🟠 ALTOS — Corrigir Esta Semana

### [BD-4] Índices ausentes em queries frequentes
```sql
-- Contatos: busca por instância + telefone (usada em todo webhook)
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_instance_phone
  ON whatsapp_contacts(instance_name, phone) INCLUDE (id, name);

-- Mensagens: busca por contato ordenada por timestamp
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_timestamp
  ON whatsapp_messages(contact_id, timestamp DESC);

-- Leads: ordenação por posição dentro de stage
DROP INDEX IF EXISTS idx_crm_leads_stage;
CREATE INDEX idx_crm_leads_stage_position
  ON crm_leads(stage_id, position DESC) INCLUDE (id, title, value);

-- Participantes de grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_participant
  ON whatsapp_messages(instance_name, participant_jid)
  WHERE participant_jid IS NOT NULL;
```

---

### [BD-5] Foreign keys ausentes — dados órfãos
```sql
ALTER TABLE whatsapp_contacts
  ADD CONSTRAINT fk_contacts_instance
  FOREIGN KEY (instance_name) REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT fk_messages_instance
  FOREIGN KEY (instance_name) REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE;
```

---

### [API-5] Todas as funções em `evolution.ts` ignoram erro HTTP
**Arquivo:** `src/lib/evolution.ts` — todas as funções fazem `return res.json()` sem checar `res.ok`  
**Impacto:** Erros da Evolution API são tratados como sucesso.

```typescript
// Padrão a aplicar em todas as funções:
const res = await fetch(...)
if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`)
return res.json()
```

---

### [API-6] N+1 queries no webhook — dupla busca de contato
**Arquivo:** `src/lib/webhook-handler.ts` linhas 69–95  
**Impacto:** Para cada mensagem recebida, faz 2 queries ao banco para buscar o mesmo contato.

```typescript
// Remover a segunda query (linha 94-95) e usar o upsert para retornar o ID:
const { data: contact } = await db.from('whatsapp_contacts')
  .upsert({ instance_name: instance, phone, name: contactName, remote_jid: remoteJid, last_message_at: timestamp },
    { onConflict: 'instance_name,phone' })
  .select('id')
  .single()
const contactId = contact?.id
```

---

### [API-7] Sem paginação em contatos — timeout com muitos dados
**Arquivo:** `src/app/api/whatsapp/contacts/route.ts` linha 17  
**Impacto:** Com 5.000+ contatos retorna tudo de uma vez.

```typescript
.order('last_message_at', { ascending: false })
.limit(100) // adicionar
```

---

### [API-8] Logs expõem dados sensíveis em produção
**Arquivos:** `webhook-handler.ts`, `send/route.ts`, `instance/route.ts`, `evolution.ts`  
**Impacto:** QR codes, números de telefone e mensagens aparecem nos logs do servidor.

Substituir `console.log` por logs sem dados pessoais ou protegidos por `NODE_ENV`:
```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log('Webhook received:', event, 'instance:', instance)
}
```

---

### [FRONT-2] Leads carregam apenas uma vez — dados desatualizados
**Arquivo:** `src/components/crm/FunnelManager.tsx` linhas 254–266  
**Impacto:** Se outro usuário move um lead, o Kanban nunca atualiza sem reload manual.

Remover o cache `leadsLoaded` e recarregar ao trocar de funil, ou adicionar polling de 60s.

---

### [FRONT-3] Cores das etapas do funil não são enviadas ao servidor
**Arquivo:** `src/components/crm/FunnelManager.tsx` linha 94  
**Impacto:** Configuração de cores é cosmética apenas — ao recarregar, cores somem.

```typescript
// Adicionar color no payload enviado ao servidor:
body: JSON.stringify({ name, stages: stages.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), color: s.color })) })
```

---

### [FRONT-4] Erro de rede no carregamento de mensagens não é tratado
**Arquivo:** `src/components/crm/ChatPanel.tsx` linhas 96–101  
**Impacto:** Falha silenciosa — usuário vê tela vazia sem saber o motivo.

```typescript
async function load() {
  try {
    const res = await fetch(`/api/whatsapp/messages?contact_id=${contact.id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
  } catch (err) {
    setError('Erro ao carregar mensagens')
  } finally {
    setLoading(false)
  }
}
```

---

### [FRONT-5] Drag de lead no Kanban sem rollback em caso de erro
**Arquivo:** `src/components/crm/KanbanBoard.tsx` linhas 428–436  
**Impacto:** Lead aparece na nova coluna mesmo se o servidor rejeitar a mudança.

```typescript
async function handleDragEnd(e: DragEndEvent) {
  const { active, over } = e
  setActiveId(null)
  if (!over) return
  const leadId = String(active.id)
  const newStageId = String(over.id)
  const previousLeads = leads // guardar estado anterior
  setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
  try {
    await onLeadMoved?.(leadId, newStageId)
  } catch {
    setLeads(previousLeads) // rollback
  }
}
```

---

## 🟡 MÉDIOS — Corrigir Próximas 2 Semanas

### [FRONT-6] Polling muito agressivo — 5 segundos por chat aberto
**Arquivo:** `ChatPanel.tsx` linha 88  
Aumentar para 30 segundos ou implementar atualização via WebSocket.
```typescript
const interval = setInterval(load, 30000) // era 5000
```

---

### [FRONT-7] Scroll automático impede leitura do histórico
**Arquivo:** `ChatPanel.tsx` linhas 92–94  
Só rolar para baixo se o usuário já estava no final da conversa.

---

### [FRONT-8] Dropdown de funil não fecha após seleção
**Arquivo:** `FunnelManager.tsx` — `switchFunnel()` não chama `setDropdownOpen(false)`.

---

### [FRONT-9] Busca de contatos sem debounce
**Arquivo:** `ContactsList.tsx` — filtro executa a cada tecla pressionada.  
Adicionar debounce de 300ms.

---

### [FRONT-10] Botão "Novo Lead" usa CustomEvent que nenhum listener captura
**Arquivo:** `FunnelManager.tsx` linha 331 — `document.dispatchEvent(new CustomEvent('kanban:newlead', ...))`  
O botão não funciona. Substituir por state.

---

### [API-9] Endpoint de debug em produção
**Arquivo:** `src/app/api/whatsapp/debug-send/route.ts`  
**Impacto:** Qualquer usuário autenticado pode enviar mensagens de teste para qualquer número.  
Remover ou proteger com verificação `isAdmin`.

---

### [API-10] Duas rotas de webhook ativas simultâneamente
**Arquivos:** `webhook/route.ts` e `webhook/[event]/route.ts`  
Manter apenas a `[event]` (catch-all) e remover ou redirecionar a raiz.

---

### [BD-6] Schema das tabelas WhatsApp não versionado
O arquivo `supabase_crm_tables.sql` está na raiz do projeto, fora do diretório `dashboard/supabase/`.  
Mover para `dashboard/supabase/02_whatsapp_crm.sql` e documentar a ordem de execução.

---

## 🟢 BAIXOS — Backlog

### [FRONT-11] Busca no Kanban não normaliza acentos
`"Jose"` não encontra `"José"`. Usar `normalize('NFD')` na comparação.

### [BD-7] Sem soft delete para auditoria
Leads e contatos deletados somem permanentemente. Considerar coluna `deleted_at`.

---

## SQL Completo para Executar Agora

```sql
-- 1. Colunas faltantes (EXECUTAR IMEDIATAMENTE)
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS qr_base64 TEXT;
ALTER TABLE whatsapp_messages  ADD COLUMN IF NOT EXISTS participant_name TEXT;
ALTER TABLE whatsapp_messages  ADD COLUMN IF NOT EXISTS participant_jid  TEXT;
ALTER TABLE crm_leads          ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 0;

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_instance_phone
  ON whatsapp_contacts(instance_name, phone) INCLUDE (id, name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_timestamp
  ON whatsapp_messages(contact_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_participant
  ON whatsapp_messages(instance_name, participant_jid)
  WHERE participant_jid IS NOT NULL;

DROP INDEX IF EXISTS idx_crm_leads_stage;
CREATE INDEX idx_crm_leads_stage_position
  ON crm_leads(stage_id, position DESC) INCLUDE (id, title, value);

-- 3. Foreign keys de integridade
ALTER TABLE whatsapp_contacts
  ADD CONSTRAINT IF NOT EXISTS fk_contacts_instance
  FOREIGN KEY (instance_name) REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE;

-- 4. Habilitar RLS (mínimo para segurança)
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_funnels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads          ENABLE ROW LEVEL SECURITY;

-- Políticas de admin (permite que o código do servidor funcione)
CREATE POLICY "admin_instances" ON whatsapp_instances FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "admin_contacts" ON whatsapp_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "admin_messages" ON whatsapp_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "admin_funnels" ON crm_funnels FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "admin_stages" ON crm_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "admin_leads" ON crm_leads FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
```

---

## Prioridade de Execução

| Quando | O que fazer |
|---|---|
| **Hoje** | BD-1 (colunas), BD-2 (RLS), API-4 (webhook erro), FRONT-1 (UI travada) |
| **Esta semana** | BD-4 (índices), API-5 (error handling Evolution), API-6 (N+1), FRONT-2 (leads desatualizados) |
| **Próximas 2 semanas** | BD-3 (transação webhook), API-1 (assinatura webhook), FRONT-6 (polling), remoção debug endpoint |
| **Backlog** | RLS completa por usuário, soft delete, WebSocket |
