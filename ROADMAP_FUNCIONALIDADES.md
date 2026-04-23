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
| Sidebar | 11 itens de navegação, notificação bell com badge, avatar, logout |

### CRM WhatsApp — Implementado
| Módulo | Funcionalidades |
|---|---|
| Chat | Mensagens individuais e grupos, nomes de participantes, polling 5s, highlight de busca |
| Kanban | Drag-and-drop, valor por lead, etapa "Lead" padrão automática, seletor de etapa no chat |
| Contatos | Listagem, busca, avatar, timestamp, filtro @lid, importação CSV, filtros salvos |
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
| 9 | Templates HSM Meta | 6/8 | ✅ | UI + API `/templates`, lista aprovados da Meta, envia via Evolution API |
| 10 | Broadcast em Massa + Analytics | 7/8 | ✅ | BroadcastManager, segmentação por tags, analytics de entrega |
| 11 | Campos Customizados por Contato | 5/8 | ✅ | Tipos: texto, número, data, select, booleano; API e UI completos |
| 12 | Sequências de Follow-up | 5/8 | ✅ | Sequências com steps, delay_hours, enrollment por contato |
| 13 | Transferência de Conversa | 5/8 | ✅ | Botão no chat, seletor de agente, nota de transferência, `conversation_assignments` |
| 14 | Departamentos + Roteamento | 5/8 | ✅ | UI de gestão, add/remove membros, atribuição de contatos, tab Deptos no sidebar |
| 15 | Timeline Unificada do Contato | 4/8 | ✅ | `contact_events`, API `/contacts/[id]/timeline` |
| 16 | Mensagens Interativas (Botões/Listas) | 6/8 | ✅ | Painel no chat, botões (até 3) e listas com seções, API `/interactive` |
| 17 | Relatório por Agente | 6/8 | ✅ | `/reports/agents`, SupervisorDashboard com tabela ordenável |
| 18 | Funil de Conversão com Taxas | 3/8 | ✅ | `lead_stage_history`, `/reports/funnel` |
| 19 | CSAT / NPS Automático | 4/8 | ✅ | `csat_responses`, API `/csat`, disparo configurável |
| 20 | Webhooks de Saída (Zapier/Make) | 5/8 | ✅ | `outbound_webhooks`, UI de configuração em OutboundWebhooks |
| 21 | Painel Supervisor em Tempo Real | 5/8 | ✅ | SupervisorDashboard com métricas do dia, fila sem resposta, desempenho por agente |
| 22 | Opt-in / Opt-out (LGPD) | 4/8 | ✅ | `optout_log`, API `/optout`, colunas opted_in/out em contatos |
| 23 | Busca Avançada + Filtros Salvos | 4/8 | ✅ | Filtros por tipo/instância/tag salvos em localStorage, aplicação em 1 clique |

---

## FASE 3 — Diferenciais Estratégicos

| # | Funcionalidade | Concorrentes | Status | Observação |
|---|---|---|---|---|
| 24 | Rastreamento UTM + Atribuição | 2/8 | ✅ | Captura referral CTWA no webhook, colunas UTM em contatos |
| 25 | Facebook Lead Ads → WhatsApp | 3/8 | ✅ | Webhook `/api/meta/leadgen`, cria contato + lead Kanban + mensagem boas-vindas |
| 26 | Meta Conversions API (CTWA Loop) | 3/8 | ✅ | Botão "Registrar como venda" no Kanban dispara evento Purchase na Meta |
| 27 | Google Ads Conversions API | 2/8 | ✅ | Integrado na rota `/conversions`, envia offline conversion quando META_PIXEL_ID configurado |
| 28 | Flow Builder Visual No-Code | 8/8 | ✅ | FlowBuilder com steps sequenciais, trigger por keyword/primeira mensagem |
| 29 | Agente IA (OpenAI/Anthropic) | 6/8 | ✅ | AIAgentManager, `ai_agents`, `ai_conversations`, handoff por keyword |
| 30 | Multi-tenant / Subcontas | 4/8 | ⚠️ | `organizations` + `org_id` em clients criados; RLS por org e UI de workspace não implementados |
| 31 | Integração HubSpot / RD Station | 4/8 | ⚠️ | `integrations` table + API de config criados; sync bidirecional não implementado |

---

## 📊 Status Geral (atualizado após implementação de P1–P9)

| Fase | Total | Implementado | Parcial | Não implementado |
|---|---|---|---|---|
| **Fase 1** | 8 | **8** ✅ | 0 | 0 |
| **Fase 2** | 15 | **15** ✅ | 0 | 0 |
| **Fase 3** | 8 | **6** ✅ | 2 ⚠️ | 0 |
| **Total** | **31** | **29 (94%)** | **2 (6%)** | **0 (0%)** |

**🆕 Além do roadmap original:** 2 funcionalidades extras implementadas (seletor de etapa no chat + etapa Lead automática).

---

## 🟡 O que ainda FALTA (apenas 2 itens)

### P8. Multi-tenant com RLS e UI de Workspace (#30)
- **O que falta:** RLS por `org_id` em todas as tabelas, tela de gestão de workspaces, convite de usuários por workspace
- **Esforço:** Alto (4–6 semanas)
- **Impacto:** Permite agência gerenciar múltiplos clientes com isolamento real de dados

### P10. Sync Bidirecional HubSpot / RD Station (#31)
- **O que falta:** Implementação real das APIs de cada CRM, mapeamento de campos, webhooks bidirecionais
- **Esforço:** Alto (4–6 semanas)
- **Impacto:** Integração com o stack que clientes já usam

---

## ⚙️ Configurações manuais necessárias (variáveis de ambiente)

Para ativar funcionalidades que dependem de APIs externas, configure no EasyPanel:

| Funcionalidade | Variáveis necessárias |
|---|---|
| Templates HSM Meta (#9) | `META_WABA_ID`, `META_ACCESS_TOKEN` |
| Meta Conversions API (#26) | `META_PIXEL_ID`, `META_ACCESS_TOKEN` |
| Facebook Lead Ads (#25) | `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_LEADGEN_WELCOME_MSG` (opcional) |
| Google Ads Conversions (#27) | `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CONVERSION_ACTION_ID`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` |

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
Evento de conversão → Meta Conversions API ✅
    ↓
Evento de conversão → Google Ads Conversions ✅
    ↓
Algoritmo otimiza automaticamente
    ↓
Relatório unificado: Tráfego + CRM + WhatsApp ✅
```

**Este sistema agora é o único no mercado** que fecha o loop completo com Meta Ads + Google Ads + CRM WhatsApp + Kanban + Lead Ads + Conversions API.

---

## 📅 Próximos Passos (apenas os 2 restantes)

| Sprint | Itens | Estimativa |
|---|---|---|
| Sprint 1 | P8 (Multi-tenant RLS + UI de workspace) | 4–6 semanas |
| Sprint 2 | P10 (HubSpot / RD Station sync bidirecional) | 4–6 semanas |

---

*Auditoria e implementação finalizada em abril/2026 — Kommo, Wati.io, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip*
