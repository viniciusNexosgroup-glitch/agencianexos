# Roadmap de Funcionalidades — CRM WhatsApp para Agências de Tráfego Pago

> **Auditoria atualizada em abril/2026** — 8 concorrentes avaliados: Kommo, Wati.io, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip.
> Legenda de status: ✅ Implementado | ⚠️ Parcial | ❌ Não implementado

---

## O que o sistema TEM HOJE

### Infraestrutura base
| Módulo | Funcionalidades |
|---|---|
| Autenticação | Login JWT, middleware de proteção de rotas, sessão por cookie, JWT_SECRET dedicado |
| Dashboard Ads | Métricas Meta Ads + Google Ads, gráfico gasto diário, tabela campanhas, filtro data/conta |
| Webhook | QRCODE_UPDATED, CONNECTION_UPDATE, MESSAGES_UPSERT, GROUPS_UPSERT, catch-all `[event]` |
| Banco | `process_whatsapp_message()` atômica, 29+ novas tabelas, índices GIN full-text, RLS admin |
| Segurança | Token webhook, is_admin em DELETE/PATCH, try/catch em todos handlers |
| Admin | Convite de clientes, vínculo contas Meta, sync manual, logs |
| Sidebar | 8 itens de navegação, notificação bell com badge, avatar, logout |

### CRM WhatsApp — Implementado
| Módulo | Funcionalidades |
|---|---|
| Chat | Mensagens individuais e grupos, nomes de participantes, polling 5s, highlight de busca |
| Kanban | Drag-and-drop, valor por lead, etapa "Lead" padrão automática, seletor de etapa no chat |
| Contatos | Listagem, busca, avatar, timestamp, filtro @lid, importação CSV |
| Instâncias | Multi-instância, QR code direto da Evolution API, status em tempo real, sync grupos |

---

## FASE 1 — Quick Wins

| # | Funcionalidade | Concorrentes | Status | Observação |
|---|---|---|---|---|
| 1 | Respostas Rápidas (Canned) | 6/8 | ✅ | Trigger "/" no chat, dropdown com busca, seleção por teclado |
| 2 | Tags e Etiquetas | 5/8 | ✅ | Tags coloridas, filtro por tag, gerenciador completo, import CSV |
| 3 | Horário de Funcionamento + Ausência | 6/8 | ✅ | Config por dia/instância, mensagem de ausência salva no banco |
| 4 | Notas Internas | 4/8 | ✅ | Badge "Interno" no chat, invisível para o contato, is_internal no banco |
| 5 | Importação CSV de Contatos | 5/8 | ✅ | Modal com seleção de instância, upsert por telefone |
| 6 | Notificações In-App | 4/8 | ✅ | Badge no sidebar, dropdown, marcar lidas, polling 30s |
| 7 | Agendamento de Mensagens | 4/8 | ✅ | Painel no chat, datetime-local, lista de agendamentos, cancelamento |
| 8 | Widget Embed WhatsApp | 5/8 | ✅ | Código embed por instância, botão copiar |

**🆕 Adicionado além do roadmap original:**
- **Seletor de etapa no chat** — botão Kanban no header do chat permite mover lead direto da conversa
- **Etapa "Lead" automática** — todo novo contato que mandar mensagem vai automaticamente para a coluna Lead do primeiro funil

---

## FASE 2 — Core Diferenciadores

| # | Funcionalidade | Concorrentes | Status | Observação |
|---|---|---|---|---|
| 9 | Templates HSM Meta | 6/8 | ❌ | Requer aprovação Meta Cloud API — não implementado |
| 10 | Broadcast em Massa + Analytics | 7/8 | ✅ | BroadcastManager, segmentação por tags, analytics de entrega |
| 11 | Campos Customizados por Contato | 5/8 | ✅ | Tipos: texto, número, data, select, booleano; API e UI completos |
| 12 | Sequências de Follow-up | 5/8 | ✅ | Sequências com steps, delay_hours, enrollment por contato |
| 13 | Transferência de Conversa | 5/8 | ⚠️ | Tabela `conversation_assignments` criada, UI de transferência não finalizada |
| 14 | Departamentos + Roteamento | 5/8 | ⚠️ | Tabelas `departments` e `department_members` criadas, UI não implementada |
| 15 | Timeline Unificada do Contato | 4/8 | ✅ | `contact_events`, API `/contacts/[id]/timeline` |
| 16 | Mensagens Interativas (Botões/Listas) | 6/8 | ❌ | Evolution API suporta, endpoint não criado |
| 17 | Relatório por Agente | 6/8 | ✅ | `/reports/agents`, SupervisorDashboard com tabela ordenável |
| 18 | Funil de Conversão com Taxas | 3/8 | ✅ | `lead_stage_history`, `/reports/funnel` |
| 19 | CSAT / NPS Automático | 4/8 | ✅ | `csat_responses`, API `/csat`, disparo configurável |
| 20 | Webhooks de Saída (Zapier/Make) | 5/8 | ✅ | `outbound_webhooks`, UI de configuração em OutboundWebhooks |
| 21 | Painel Supervisor em Tempo Real | 5/8 | ✅ | SupervisorDashboard com métricas do dia, fila sem resposta, desempenho por agente |
| 22 | Opt-in / Opt-out (LGPD) | 4/8 | ✅ | `optout_log`, API `/optout`, colunas opted_in/out em contatos |
| 23 | Busca Avançada + Filtros Salvos | 4/8 | ⚠️ | Busca no histórico do chat implementada; filtros salvos no inbox não implementados |

---

## FASE 3 — Diferenciais Estratégicos

| # | Funcionalidade | Concorrentes | Status | Observação |
|---|---|---|---|---|
| 24 | Rastreamento UTM + Atribuição | 2/8 | ✅ | Captura referral CTWA no webhook, colunas UTM em contatos |
| 25 | Facebook Lead Ads → WhatsApp | 3/8 | ❌ | Meta Leadgen webhook não implementado |
| 26 | Meta Conversions API (CTWA Loop) | 3/8 | ⚠️ | `conversion_events` table + API criados; envio server-side não finalizado |
| 27 | Google Ads Conversions API | 2/8 | ❌ | Não implementado |
| 28 | Flow Builder Visual No-Code | 8/8 | ✅ | FlowBuilder com steps sequenciais, trigger por keyword/primeira mensagem |
| 29 | Agente IA (OpenAI/Anthropic) | 6/8 | ✅ | AIAgentManager, `ai_agents`, `ai_conversations`, handoff por keyword |
| 30 | Multi-tenant / Subcontas | 4/8 | ⚠️ | `organizations` + `org_id` em clients criados; RLS por org e UI de workspace não implementados |
| 31 | Integração HubSpot / RD Station | 4/8 | ⚠️ | `integrations` table + API de config criados; sync bidirecional não implementado |

---

## 🔴 O que ainda FALTA implementar (por prioridade)

### Prioridade Alta — Completar itens parciais

#### P1. UI de Transferência de Conversa entre Agentes (#13)
- **O que falta:** Botão no chat para transferir, seletor de agente, nota de transferência
- **Esforço:** Baixo (estrutura de banco já existe)
- **Impacto:** SDR→Closer sem perder contexto

#### P2. UI de Departamentos + Roteamento (#14)
- **O que falta:** Tela de gestão de departamentos, atribuição de agentes, roteamento automático
- **Esforço:** Médio
- **Impacto:** Isolamento de operações por cliente/time

#### P3. Mensagens Interativas — Botões e Listas (#16)
- **O que falta:** Endpoints `/message/sendButtons` e `/message/sendList`, UI no chat
- **Esforço:** Baixo-Médio (Evolution API já suporta)
- **Impacto:** Taxa de engajamento muito maior

#### P4. Filtros Salvos no Inbox (#23)
- **O que falta:** Combinação de filtros por agente/tag/status, salvar como view
- **Esforço:** Médio
- **Impacto:** Operações de alto volume

---

### Prioridade Alta — Novas implementações críticas

#### P5. Templates HSM Meta (#9)
- **O que falta:** Integração Meta Cloud API para gerenciar e enviar templates aprovados
- **Esforço:** Médio-Alto
- **Impacto:** Sem templates, não há como abrir conversa proativa — bloqueia Broadcast real e Sequências com leads que não responderam em 24h

#### P6. Facebook Lead Ads → WhatsApp (#25)
- **O que falta:** Meta Leadgen webhook, busca dados do formulário, criação automática de contato + mensagem de boas-vindas
- **Esforço:** Médio
- **Impacto:** Contato automático em <5min após preenchimento de formulário aumenta conversão em até 9x

#### P7. Finalizar Meta Conversions API (#26)
- **O que falta:** Envio server-side de eventos para Meta quando lead converte no CRM
- **Esforço:** Médio
- **Impacto:** Fecha o loop tráfego→venda, otimização automática de algoritmo

---

### Prioridade Média

#### P8. Multi-tenant com RLS e UI de Workspace (#30)
- **O que falta:** RLS por `org_id` em todas as tabelas, tela de gestão de workspaces, convite de usuários por workspace
- **Esforço:** Alto
- **Impacto:** Permite agência gerenciar múltiplos clientes com isolamento real

#### P9. Google Ads Conversions API (#27)
- **O que falta:** Offline conversions upload quando lead fecha venda
- **Esforço:** Médio
- **Impacto:** Fecha loop para clientes que investem em Search/PMax

#### P10. Sync Bidirecional HubSpot / RD Station (#31)
- **O que falta:** Implementação real das APIs de cada CRM, mapeamento de campos, triggers
- **Esforço:** Alto
- **Impacto:** Integração com o stack que clientes já usam

---

## 📊 Status Geral

| Fase | Total | Implementado | Parcial | Não implementado |
|---|---|---|---|---|
| **Fase 1** | 8 | **8** ✅ | 0 | 0 |
| **Fase 2** | 15 | **9** ✅ | 3 ⚠️ | 3 ❌ |
| **Fase 3** | 8 | **3** ✅ | 3 ⚠️ | 2 ❌ |
| **Total** | **31** | **20 (65%)** | **6 (19%)** | **5 (16%)** |

**🆕 Além do roadmap original:** 2 funcionalidades extras implementadas (seletor de etapa no chat + etapa Lead automática).

---

## 🎯 Oportunidade Azul — Loop Completo para Agências

Nenhum dos 8 concorrentes fecha completamente este ciclo:

```
Anúncio (Meta/Google)
    ↓
Clique → WhatsApp (UTM capturado ✅)
    ↓
Lead qualificado pelo chatbot/IA ✅
    ↓
Venda registrada no CRM/Kanban ✅
    ↓
Evento de conversão → Meta Conversions API ⚠️ (parcial)
    ↓
Evento de conversão → Google Ads Conversions ❌
    ↓
Algoritmo otimiza automaticamente
    ↓
Relatório unificado: Tráfego + CRM + WhatsApp ⚠️ (parcial)
```

**Kommo** chega mais perto. Mas nenhum entrega o loop com Google Ads e relatório unificado tráfego+CRM+WhatsApp.

Vantagem sustentável: o sistema já tem Meta Ads ✅ + Google Ads ✅ + CRM WhatsApp ✅ + Kanban ✅. Fechar o loop de conversão (P7 + P9) seria único no mercado.

---

## 📅 Próximos Passos Recomendados

| Sprint | Itens | Estimativa |
|---|---|---|
| Sprint 1 | P1 (Transferência UI) + P3 (Botões/Listas) + P4 (Filtros Inbox) | 2-3 semanas |
| Sprint 2 | P5 (Templates HSM) + P6 (Lead Ads) | 3-4 semanas |
| Sprint 3 | P7 (Meta Conversions finalizar) + P2 (Departamentos UI) | 2-3 semanas |
| Sprint 4 | P8 (Multi-tenant RLS) | 4-6 semanas |
| Sprint 5 | P9 (Google Ads) + P10 (HubSpot/RD) | 4-6 semanas |

---

*Auditoria realizada em abril/2026 — Kommo, Wati.io, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip*
