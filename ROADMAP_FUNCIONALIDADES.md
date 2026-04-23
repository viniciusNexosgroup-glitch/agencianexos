# Roadmap de Funcionalidades — CRM WhatsApp para Agências de Tráfego Pago

> Análise realizada em abril/2026 comparando 8 concorrentes: Kommo, Wati.io, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip.

---

## O que o sistema JÁ TEM

| Módulo | Funcionalidades Implementadas |
|---|---|
| Autenticação | Login JWT, middleware de proteção de rotas, sessão por cookie |
| Dashboard Ads | Métricas Meta Ads + Google Ads, gráfico de gasto diário, tabela de campanhas, filtro por data/conta |
| CRM — Chat | Chat WhatsApp individual e grupos, envio/recebimento, polling 5s, nomes de participantes de grupo |
| CRM — Kanban | Drag-and-drop de leads entre etapas, valor por lead, contato vinculado |
| CRM — Contatos | Listagem, busca, avatar, timestamp última mensagem, filtro @lid |
| CRM — Instâncias | Multi-instância WhatsApp, QR code, sincronização de grupos, status em tempo real |
| Webhook | Processamento de QRCODE, CONNECTION_UPDATE, MESSAGES_UPSERT, GROUPS_UPSERT |
| Banco de dados | Função atômica `process_whatsapp_message()`, índices de performance, RLS admin |
| Segurança | Token webhook, JWT_SECRET dedicado, is_admin em DELETE/PATCH, try/catch em todos os handlers |
| Admin | Convite de clientes, vínculo de contas Meta, trigger manual de sync, logs de sincronização |

---

## Funcionalidades que FALTAM — Análise de Concorrentes

### Legenda
- **Concorrentes:** de 8 avaliados (Kommo, Wati, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip)
- **Complexidade:** Baixa (dias) / Média (semanas) / Alta (meses)
- **Impacto:** para agências de tráfego pago especificamente

---

## 🔴 FASE 1 — Quick Wins (Alta prioridade, baixa-média complexidade)
> Implementar primeiro. Retorno rápido, diferencial imediato.

### 1. Respostas Rápidas (Canned Responses)
- **Concorrentes:** 6/8 (Chatwoot, Wati, Respond.io, Kommo, Zenvia, Botmaker)
- **Complexidade:** Baixa
- **Impacto:** Alto
- **O que é:** Biblioteca de respostas pré-cadastradas acionadas por atalho no chat (ex: `/orcamento` expande para o texto completo). Economiza tempo em perguntas frequentes.
- **Por que para agências:** Os primeiros 5 minutos definem a conversão. Agentes que respondem leads de anúncios mais rápido convertem mais.
- **BD necessário:** Tabela `quick_replies (id, shortcut, content, created_by)`

### 2. Tags e Etiquetas em Contatos e Conversas
- **Concorrentes:** 5/8 (Chatwoot, Wati, Kommo, Respond.io, Zenvia)
- **Complexidade:** Baixa-Média
- **Impacto:** Alto
- **O que é:** Etiquetas livres ou predefinidas em contatos e conversas. Permitem filtrar, segmentar para broadcasts e acionar automações condicionais.
- **Por que para agências:** Mecanismo primário de segmentação. Sem tags não há como diferenciar "lead quente", "prospect frio", "cliente ativo", "perdido".
- **BD necessário:** Tabelas `tags`, `contact_tags (contact_id, tag_id)`, `conversation_tags`

### 3. Horário de Funcionamento + Mensagem de Ausência
- **Concorrentes:** 6/8 (Wati, Kommo, Chatwoot, Zenvia, Respond.io, Take Blip)
- **Complexidade:** Baixa-Média
- **Impacto:** Alto
- **O que é:** Configuração de dias/horários de atendimento por instância. Fora do horário, dispara mensagem automática de ausência configurável.
- **Por que para agências:** Leads de tráfego pago chegam 24h. Sem resposta automática fora do horário, o custo por lead é desperdiçado — o lead esfria e vai para o concorrente.
- **BD necessário:** Tabela `business_hours (instance_name, weekday, open_time, close_time, away_message)`

### 4. Notas Internas + @Menção entre Agentes
- **Concorrentes:** 4/8 (Chatwoot, Respond.io, Wati, Kommo)
- **Complexidade:** Baixa
- **Impacto:** Médio
- **O que é:** Campo de nota interna visível só para a equipe dentro do chat (invisível para o cliente). Agentes podem @mencionar colegas.
- **Por que para agências:** SDRs passam contexto para closers sem o lead ver. Supervisores deixam orientações discretamente.
- **BD necessário:** Coluna `is_internal BOOLEAN` em `whatsapp_messages` + tabela `mentions`

### 5. Importação de Contatos via CSV
- **Concorrentes:** 5/8 (Wati, Kommo, Respond.io, Zenvia, Chatwoot)
- **Complexidade:** Baixa-Média
- **Impacto:** Alto
- **O que é:** Upload de lista de contatos CSV/Excel com mapeamento de colunas. Detecção e tratamento de duplicatas.
- **Por que para agências:** Agências migram bases de outros CRMs, importam listas de leads de Facebook Lead Ads, incorporam bases dos clientes.
- **BD necessário:** Sem alteração de schema; usar upsert existente em `whatsapp_contacts`

### 6. Central de Notificações Configurável
- **Concorrentes:** 4/8 (Wati, Respond.io, Chatwoot, Kommo)
- **Complexidade:** Baixa-Média
- **Impacto:** Médio-Alto
- **O que é:** Notificações in-app + e-mail para: nova mensagem recebida, lead mudou de etapa, menção em nota. Configurável por tipo de evento por usuário.
- **Por que para agências:** Sem notificações, agentes perdem leads. A velocidade de resposta é o principal driver de conversão em tráfego pago.
- **BD necessário:** Tabela `notifications (user_id, type, read, payload, created_at)`

### 7. Agendamento de Mensagens
- **Concorrentes:** 4/8 (Wati, Kommo, ManyChat, Zenvia)
- **Complexidade:** Baixa-Média
- **Impacto:** Médio
- **O que é:** Interface para programar mensagens individuais para data/hora futura com suporte a fuso horário.
- **Por que para agências:** Follow-ups programados, lembretes de reunião, mensagens no melhor horário para o lead.
- **BD necessário:** Tabela `scheduled_messages (contact_id, instance_name, body, send_at, status)`

### 8. Widget de Chat para Site (Botão WhatsApp)
- **Concorrentes:** 5/8 (Kommo, Zenvia, Take Blip, Botmaker, Chatwoot)
- **Complexidade:** Baixa-Média
- **Impacto:** Médio-Alto
- **O que é:** Script embed para o site do cliente com botão "Fale conosco no WhatsApp". Ao clicar, abre conversa e registra automaticamente o lead no CRM com a URL de origem.
- **Por que para agências:** Converte visitantes orgânicos e de outras fontes além de tráfego pago. Complementa a estratégia.
- **BD necessário:** Campo `source_url TEXT` em `whatsapp_contacts`

---

## 🟠 FASE 2 — Core Diferenciadores (Complexidade média, impacto alto)
> Implementar após a Fase 1. Define a proposta de valor central do produto.

### 9. Templates HSM com Gerenciamento de Aprovação Meta
- **Concorrentes:** 6/8 (Wati, Kommo, Respond.io, Zenvia, Take Blip, Botmaker)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Gerenciador interno de templates aprovados pela Meta (HSM) para abrir conversas proativas. Inclui variáveis dinâmicas, mídia, botões de ação e categorias (marketing, utilidade, autenticação).
- **Por que para agências:** Sem templates aprovados, não há como fazer follow-up ativo com leads que não responderam na janela de 24h. Obrigatório para réguas de nutrição.
- **Integração necessária:** Meta Cloud API — `POST /{phone-number-id}/message_templates`

### 10. Broadcast em Massa com Segmentação e Analytics
- **Concorrentes:** 7/8 — o mais presente entre todos os concorrentes
- **Complexidade:** Média-Alta
- **Impacto:** Alto
- **O que é:** Envio de templates aprovados para listas segmentadas por tag, status, campo customizado. Relatório de entrega, leitura e resposta por campanha.
- **Por que para agências:** Campanhas de reengajamento, recuperação de leads frios, promoções sazonais para base ativa. ROI direto e mensurável.
- **BD necessário:** Tabelas `broadcast_campaigns`, `broadcast_recipients (campaign_id, contact_id, status, delivered_at, read_at)`

### 11. Campos Customizados por Contato
- **Concorrentes:** 5/8 (Kommo, Wati, Respond.io, Chatwoot, Zenvia)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Criação de campos personalizados no perfil do contato (texto, número, data, select, booleano). Ex: "Orçamento mensal de tráfego", "Segmento", "Score de qualificação".
- **Por que para agências:** Sem campos customizados não é possível segmentar leads para disparos personalizados nem registrar dados de qualificação coletados no chatbot.
- **BD necessário:** Tabelas `custom_field_definitions (name, type, options)` + `custom_field_values (contact_id, field_id, value)`

### 12. Sequências de Follow-up Automatizadas (Régua de Cadência)
- **Concorrentes:** 5/8 (Kommo, Wati, Respond.io, ManyChat, Zenvia)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Sequências programadas: "se lead não respondeu em X horas, enviar Y; se ainda não respondeu em X dias, enviar Z". Substitui o follow-up manual da equipe.
- **Por que para agências:** 80% das vendas ocorrem entre o 5º e 12º contato. Sem cadência automatizada, leads que custaram dinheiro em tráfego são desperdiçados.
- **BD necessário:** Tabelas `sequences (name, trigger_event)` + `sequence_steps (sequence_id, delay_hours, template_id)` + `sequence_enrollments`

### 13. Transferência de Conversa entre Agentes com Histórico
- **Concorrentes:** 5/8 (Chatwoot, Zenvia, Wati, Respond.io, Botmaker)
- **Complexidade:** Baixa-Média
- **Impacto:** Alto
- **O que é:** Agente transfere conversa para outro com contexto completo preservado. Receptor vê todo o histórico e nota de transferência.
- **Por que para agências:** Em operações com SDR+closer, o lead é passado entre profissionais. Sem estrutura, o contexto se perde e a conversão cai.
- **BD necessário:** Tabela `conversation_assignments (contact_id, from_agent, to_agent, note, assigned_at)`

### 14. Departamentos / Times com Roteamento
- **Concorrentes:** 5/8 (Wati, Chatwoot, Respond.io, Zenvia, Botmaker)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Organização de agentes em departamentos (Vendas, Suporte, Financeiro). Conversas roteadas para o departamento correto com fila e métricas independentes.
- **Por que para agências:** Agências gerenciam múltiplos clientes. Departamentos = isolamento de operações por conta.
- **BD necessário:** Tabelas `departments`, `department_members (department_id, user_id)`, coluna `department_id` em `whatsapp_contacts`

### 15. Timeline Unificada do Contato
- **Concorrentes:** 4/8 (Kommo, Respond.io, Zenvia, Take Blip)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Linha do tempo no perfil do contato: mensagens, mudanças de etapa no kanban, notas, atribuições, campanhas recebidas, campos atualizados. Contexto completo do relacionamento.
- **Por que para agências:** Quando lead retorna após semanas, o agente precisa do contexto sem reler todo o histórico de chat.
- **BD necessário:** Tabela `contact_events (contact_id, type, payload, created_at)` — event sourcing

### 16. Mensagens Interativas da API Meta (Botões, Listas)
- **Concorrentes:** 6/8 (Wati, Kommo, Respond.io, ManyChat, Zenvia, Take Blip)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Suporte aos tipos interativos da Meta: Reply Buttons (até 3 botões), List Messages (até 10 opções), Flow Messages (formulários nativos do WhatsApp).
- **Por que para agências:** Mensagens com botões têm taxa de engajamento significativamente maior. Fundamentais para qualificação automatizada.
- **Integração necessária:** Endpoint `/message/sendButtons` e `/message/sendList` da Evolution API já suportam isso

### 17. Relatório de Desempenho por Agente
- **Concorrentes:** 6/8 (Wati, Chatwoot, Respond.io, Zenvia, Botmaker, Take Blip)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Dashboard com métricas individuais: conversas atendidas, tempo médio de primeira resposta, tempo médio de resolução, taxa CSAT, conversas transferidas.
- **Por que para agências:** Gestores precisam medir produtividade do time de vendas para justificar resultados aos clientes.
- **BD necessário:** View materializada com agregações de `whatsapp_messages` e `conversation_assignments`

### 18. Funil de Conversão com Taxas por Etapa
- **Concorrentes:** 3/8 (Kommo, Respond.io, Zenvia)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Visualização do funil: volume de leads por etapa, taxa de conversão entre etapas, tempo médio de permanência, leads perdidos por motivo.
- **Por que para agências:** Para otimizar o processo de vendas do cliente é preciso ver onde os leads morrem no funil.
- **BD necessário:** Tabela `lead_stage_history (lead_id, from_stage, to_stage, changed_at)` + coluna `lost_reason` em `crm_leads`

### 19. CSAT / NPS Automático pós-Atendimento
- **Concorrentes:** 4/8 (Chatwoot, Zenvia, Respond.io, Wati)
- **Complexidade:** Média
- **Impacto:** Médio-Alto
- **O que é:** Ao encerrar conversa, o sistema envia pesquisa de satisfação automaticamente (estrelas ou NPS 0-10). Dashboard de qualidade por agente e período.
- **Por que para agências:** Prova qualidade do atendimento para clientes da agência. Diferencial de retenção de contrato.
- **BD necessário:** Tabela `csat_responses (contact_id, agent_id, score, comment, created_at)`

### 20. Webhooks de Saída Configuráveis (Zapier / Make / N8N)
- **Concorrentes:** 5/8 (Wati, Respond.io, Kommo, Chatwoot, Botmaker)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Interface para configurar webhooks de saída para eventos específicos (novo lead, mudança de etapa, mensagem recebida). Integração nativa com Zapier e Make.
- **Por que para agências:** Agências usam ecossistemas de ferramentas (Google Sheets, Notion, Slack, HubSpot, RD Station). Webhooks eliminam dependência do dev para integrações.
- **BD necessário:** Tabela `outbound_webhooks (event_type, url, secret, active)`

### 21. Painel do Supervisor em Tempo Real
- **Concorrentes:** 5/8 (Wati, Chatwoot, Zenvia, Respond.io, Botmaker)
- **Complexidade:** Média
- **Impacto:** Alto
- **O que é:** Visão em tempo real para gestores: conversas ativas agora, agentes online/ausentes, conversas em fila sem resposta, métricas do dia.
- **Por que para agências:** O gestor da agência (ou o cliente) precisa ver em tempo real como está a operação de atendimento sem precisar pedir relatório.
- **Tecnologia necessária:** WebSockets ou Server-Sent Events para updates em tempo real

### 22. Opt-in / Opt-out Gerenciado (LGPD + Meta Compliance)
- **Concorrentes:** 4/8 (Wati, Kommo, Zenvia, Respond.io)
- **Complexidade:** Média
- **Impacto:** Médio-Alto
- **O que é:** Registro de consentimento (opt-in com data e origem). Ao fazer opt-out, contato é automaticamente removido de todos os broadcasts futuros.
- **Por que para agências:** Obrigação legal (LGPD) e operacional — contas de WhatsApp são banidas por envio para quem optou out.
- **BD necessário:** Colunas `opted_in BOOLEAN`, `opted_in_at TIMESTAMPTZ`, `opted_out_at TIMESTAMPTZ` em `whatsapp_contacts`

### 23. Busca Avançada e Filtros Salvos no Inbox
- **Concorrentes:** 4/8 (Chatwoot, Respond.io, Wati, Zenvia)
- **Complexidade:** Média
- **Impacto:** Médio
- **O que é:** Busca full-text em histórico de conversas, filtros combinados por agente, tag, status, data. Salvar filtros como views personalizadas.
- **Por que para agências:** Fundamental para operações com alto volume de conversas. Achar um lead específico rapidamente.
- **BD necessário:** Índice GIN de full-text search em `whatsapp_messages.body`

---

## 🔵 FASE 3 — Diferenciais Estratégicos para Agências (Alta complexidade, impacto crítico)
> Os que nenhum concorrente resolve completamente. Vantagem competitiva real.

### 24. Rastreamento UTM + Atribuição de Origem de Lead
- **Concorrentes:** 2/8 (Kommo parcial, Respond.io)
- **Complexidade:** Alta
- **Impacto:** Alto Crítico
- **O que é:** Captura automática dos parâmetros UTM do link Click-to-WhatsApp. O lead card registra `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. Relatório de qual anúncio gerou qual lead e qual converteu em venda.
- **Por que para agências:** É o coração do negócio de agência de tráfego pago. Saber qual anúncio gerou qual venda fecha o loop do ROI e justifica o investimento.
- **BD necessário:** Colunas UTM em `whatsapp_contacts`; integração com Meta Conversations API para capturar `referral` object do CTWA

### 25. Facebook Lead Ads → WhatsApp (Captura Automática)
- **Concorrentes:** 3/8 (Kommo, Wati, Respond.io)
- **Complexidade:** Alta
- **Impacto:** Alto Crítico
- **O que é:** Integração com Facebook Lead Ads: quando alguém preenche formulário de anúncio, cria automaticamente o contato no CRM e dispara mensagem de boas-vindas no WhatsApp em segundos.
- **Por que para agências:** Contato automático nos primeiros 5 minutos após preenchimento aumenta a taxa de conversão em até 9x. Sem isso, os leads esfriam antes de serem contatados manualmente.
- **Integração necessária:** Meta Webhooks (Leadgen) + Meta Lead Ads API para buscar dados do formulário

### 26. Integração Nativa Meta Ads (Click-to-WhatsApp + CTWA Analytics)
- **Concorrentes:** 3/8 (Kommo, Botmaker parcial, Wati parcial)
- **Complexidade:** Alta
- **Impacto:** Alto Crítico
- **O que é:** Conexão direta com conta de anúncios para: capturar leads CTWA no CRM com metadados do anúncio (campaign, ad set, ad), sincronizar eventos de conversão de volta para o Meta (Conversions API) para otimização de algoritmo.
- **Por que para agências:** Fechar o loop tráfego → conversa → venda → sinal de otimização é o diferencial máximo. Nenhum concorrente faz isso completamente. É o produto azul do mercado.
- **Integração necessária:** Meta Conversions API (server-side events) + parsing do `referral` object nos webhooks da Evolution API

### 27. Integração Google Ads (Conversão de WhatsApp → Google)
- **Concorrentes:** 2/8 (Botmaker parcial, Kommo parcial)
- **Complexidade:** Alta
- **Impacto:** Alto Crítico
- **O que é:** Quando um lead originado de anúncio Google converte em venda no WhatsApp CRM, envia evento de conversão para o Google Ads via Conversions API. Fecha o loop para otimização de campanhas Search e Performance Max.
- **Por que para agências:** Agências que gerenciam Google Ads e WhatsApp precisam fechar o loop de conversão para os lances automáticos funcionarem corretamente. O sistema já tem integração com Google Ads (dashboard) — essa funcionalidade completa o ciclo.
- **Integração necessária:** Google Ads Conversions API (offline conversions upload)

### 28. Flow Builder Visual (Construtor de Chatbot No-Code)
- **Concorrentes:** 8/8 — presente em TODOS os concorrentes
- **Complexidade:** Alta
- **Impacto:** Alto
- **O que é:** Interface drag-and-drop para criar fluxos de conversa automatizados: nós de mensagem, condição, ramificação por resposta, timers, ações (criar lead, atualizar campo, atribuir agente).
- **Por que para agências:** Sem flow builder, o sistema não consegue qualificar leads automaticamente após o clique no anúncio. É o coração da automação pós-conversão. O único item presente em todos os 8 concorrentes.
- **BD necessário:** Tabelas `flows (name, trigger)` + `flow_nodes (flow_id, type, config, position_x, position_y)` + `flow_edges (from_node, to_node, condition)` + `flow_executions`

### 29. Agente de IA com LLM (GPT-4 / Claude)
- **Concorrentes:** 6/8 (Respond.io, Wati, Take Blip, Botmaker, ManyChat, Kommo)
- **Complexidade:** Alta
- **Impacto:** Alto
- **O que é:** Agente de linguagem natural treinado com dados do negócio. Responde perguntas abertas, qualifica leads por intenção real (não palavras-chave), faz handoff para humano quando necessário, atualiza campos do CRM mid-conversa.
- **Por que para agências:** O principal diferencial competitivo de 2025-2026. Agências com alto volume de leads de tráfego pago recebem fora do horário comercial. Um agente IA qualifica e converte sem custo humano.
- **Integração necessária:** OpenAI/Anthropic API + RAG com base de conhecimento por instância + function calling para atualizar CRM

### 30. Multi-tenant / Subcontas por Cliente com Painel Central
- **Concorrentes:** 4/8 (Wati, Botmaker, Zenvia BSP, Take Blip)
- **Complexidade:** Alta
- **Impacto:** Alto Crítico
- **O que é:** A agência cria workspaces isolados por cliente, cada um com seus próprios agentes, números de WhatsApp, dados e configurações. A agência tem acesso administrativo a todos os workspaces de um painel central.
- **Por que para agências:** Sem multi-tenant, a agência não pode usar o mesmo sistema para gerenciar múltiplos clientes com isolamento de dados. É o modelo de negócio da agência.
- **BD necessário:** Tabela `organizations (id, name, slug)` + coluna `org_id` em todas as tabelas de CRM + RLS por organização

### 31. Integração HubSpot / RD Station (Bidirecional)
- **Concorrentes:** 4/8 (Wati, Kommo, Respond.io, Take Blip)
- **Complexidade:** Alta
- **Impacto:** Alto
- **O que é:** Sincronização bidirecional com HubSpot e RD Station. Leads criados no WhatsApp CRM aparecem automaticamente no CRM principal e vice-versa.
- **Por que para agências:** A maioria dos clientes já usa HubSpot ou RD Station. O WhatsApp CRM precisa complementar, não substituir o CRM principal deles.
- **Integração necessária:** HubSpot CRM API v3 + RD Station Marketing API

---

## 📊 Tabela Resumo por Fase

| # | Funcionalidade | Concorrentes | Complexidade | Impacto | Fase |
|---|---|---|---|---|---|
| 1 | Respostas Rápidas (Canned) | 6/8 | Baixa | Alto | 1 |
| 2 | Tags e Etiquetas | 5/8 | Baixa-Média | Alto | 1 |
| 3 | Horário de Funcionamento + Ausência | 6/8 | Baixa-Média | Alto | 1 |
| 4 | Notas Internas + @Menção | 4/8 | Baixa | Médio | 1 |
| 5 | Importação CSV de Contatos | 5/8 | Baixa-Média | Alto | 1 |
| 6 | Central de Notificações | 4/8 | Baixa-Média | Médio-Alto | 1 |
| 7 | Agendamento de Mensagens | 4/8 | Baixa-Média | Médio | 1 |
| 8 | Widget de Chat para Site | 5/8 | Baixa-Média | Médio-Alto | 1 |
| 9 | Templates HSM (Meta) | 6/8 | Média | Alto | 2 |
| 10 | Broadcast em Massa + Analytics | 7/8 | Média-Alta | Alto | 2 |
| 11 | Campos Customizados por Contato | 5/8 | Média | Alto | 2 |
| 12 | Sequências de Follow-up Automático | 5/8 | Média | Alto | 2 |
| 13 | Transferência de Conversa | 5/8 | Baixa-Média | Alto | 2 |
| 14 | Departamentos + Roteamento | 5/8 | Média | Alto | 2 |
| 15 | Timeline Unificada do Contato | 4/8 | Média | Alto | 2 |
| 16 | Mensagens Interativas Meta API | 6/8 | Média | Alto | 2 |
| 17 | Relatório de Desempenho por Agente | 6/8 | Média | Alto | 2 |
| 18 | Funil de Conversão com Taxas | 3/8 | Média | Alto | 2 |
| 19 | CSAT / NPS Automático | 4/8 | Média | Médio-Alto | 2 |
| 20 | Webhooks de Saída (Zapier/Make) | 5/8 | Média | Alto | 2 |
| 21 | Painel do Supervisor em Tempo Real | 5/8 | Média | Alto | 2 |
| 22 | Opt-in / Opt-out (LGPD) | 4/8 | Média | Médio-Alto | 2 |
| 23 | Busca Avançada + Filtros Salvos | 4/8 | Média | Médio | 2 |
| 24 | Rastreamento UTM + Atribuição | 2/8 | Alta | **Crítico** | 3 |
| 25 | Facebook Lead Ads → WhatsApp | 3/8 | Alta | **Crítico** | 3 |
| 26 | Integração Meta Ads CTWA Completa | 3/8 | Alta | **Crítico** | 3 |
| 27 | Integração Google Ads (Conversão) | 2/8 | Alta | **Crítico** | 3 |
| 28 | Flow Builder Visual No-Code | 8/8 | Alta | Alto | 3 |
| 29 | Agente de IA (LLM Nativo) | 6/8 | Alta | Alto | 3 |
| 30 | Multi-tenant / Subcontas | 4/8 | Alta | **Crítico** | 3 |
| 31 | Integração HubSpot / RD Station | 4/8 | Alta | Alto | 3 |

---

## 🎯 Oportunidade Azul — Diferencial Único para Agências de Tráfego Pago

Nenhum dos 8 concorrentes fecha completamente este ciclo:

```
Anúncio (Meta/Google)
    ↓
Clique → WhatsApp (com UTM capturado)
    ↓
Lead qualificado pelo chatbot/agente
    ↓
Venda registrada no CRM
    ↓
Evento de conversão enviado de volta para Meta Conversions API e Google Ads
    ↓
Algoritmo otimiza automaticamente para perfis que convertem
    ↓
Relatório unificado: "Investi R$10k → 200 leads → 12 vendas → R$84k → ROAS 8,4x"
```

**Kommo** chega mais perto (UTM parcial + CTWA). Mas nenhum entrega o loop completo integrado com Google Ads e com o relatório unificado de tráfego + CRM + WhatsApp.

Isso representa a **principal vantagem competitiva sustentável** para este sistema, especialmente porque ele já tem:
- Dashboard de Meta Ads ✅
- Dashboard de Google Ads ✅  
- CRM WhatsApp com Kanban ✅
- Webhook de eventos WhatsApp ✅

Falta apenas fechar o loop nos dois sentidos (captura de origem + devolução de conversão).

---

## 📅 Estimativa de Timeline

| Fase | Funcionalidades | Estimativa |
|---|---|---|
| **Fase 1** | Quick Wins (#1 ao #8) | 6-8 semanas |
| **Fase 2** | Core Diferenciadores (#9 ao #23) | 3-5 meses |
| **Fase 3** | Diferenciais Estratégicos (#24 ao #31) | 4-8 meses |

---

## 🗄️ Banco de Dados — Novas Tabelas Necessárias (Fase 1 e 2)

```sql
-- Fase 1
CREATE TABLE quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES clients(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_tags (
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL, -- 0=Dom, 1=Seg, ..., 6=Sab
  open_time TIME,
  close_time TIME,
  away_message TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  body TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar às tabelas existentes
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS opted_in BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

-- Fase 2
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  field_type TEXT NOT NULL, -- text, number, date, select, boolean
  options JSONB, -- para tipo select
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  field_id UUID REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value TEXT,
  UNIQUE (contact_id, field_id)
);

CREATE TABLE contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- message, stage_change, note, assignment, field_update
  payload JSONB,
  created_by UUID REFERENCES clients(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES crm_stages(id),
  to_stage_id UUID REFERENCES crm_stages(id),
  changed_by UUID REFERENCES clients(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES clients(id);

CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id TEXT, -- ID do template Meta
  instance_name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, running, completed, failed
  total_recipients INT DEFAULT 0,
  sent INT DEFAULT 0,
  delivered INT DEFAULT 0,
  read_count INT DEFAULT 0,
  replied INT DEFAULT 0,
  created_by UUID REFERENCES clients(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, replied, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

CREATE TABLE outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- new_lead, stage_change, message_received, etc.
  url TEXT NOT NULL,
  secret TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE csat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  assigned_agent UUID REFERENCES clients(id),
  score SMALLINT CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

*Gerado em abril/2026 — Baseado em análise de Kommo, Wati.io, Respond.io, Zenvia, Botmaker, Chatwoot, ManyChat, Take Blip*
