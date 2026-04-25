# Checklist de Testes Manuais — CRM WhatsApp

> Execute em produção com um número de WhatsApp real conectado.
> Legenda: ✅ Passou | ❌ Falhou (anote o erro) | ⏭ Pulado (sem pré-requisito)

---

## 1. Autenticação

| # | Teste | Resultado |
|---|---|---|
| 1.1 | Acessar `/login` sem sessão → deve aparecer tela de login | |
| 1.2 | Login com email/senha corretos → redireciona para dashboard | |
| 1.3 | Login com senha errada → exibe mensagem de erro | |
| 1.4 | Acessar `/dashboard` sem login → redireciona para `/login` | |
| 1.5 | Clicar em "Sair" → sessão encerrada, redireciona para login | |

---

## 2. Instâncias WhatsApp

| # | Teste | Resultado |
|---|---|---|
| 2.1 | Acessar aba **Instâncias** → lista carrega sem erro | |
| 2.2 | Criar nova instância → aparece na lista | |
| 2.3 | Clicar em "Ver QR Code" → modal abre com QR ou mensagem de status | |
| 2.4 | Conectar o WhatsApp escaneando o QR → status muda para "connected" | |
| 2.5 | Desconectar instância → status muda para "disconnected" | |
| 2.6 | Excluir instância → some da lista | |
| 2.7 | Clicar "Sincronizar Grupos" → não dá erro 500 | |

---

## 3. Chat / Conversas

| # | Teste | Resultado |
|---|---|---|
| 3.1 | Enviar mensagem de um número externo → aparece no chat em até 5s | |
| 3.2 | Responder pelo chat → mensagem enviada aparece no WhatsApp do contato | |
| 3.3 | Buscar contato pelo nome na lista → filtra corretamente | |
| 3.4 | Buscar texto dentro de conversa → destaca o termo encontrado | |
| 3.5 | Enviar nota interna (botão 🔒) → aparece com badge "Interno", invisível no WhatsApp | |
| 3.6 | Resposta rápida: digitar "/" → dropdown aparece com as respostas cadastradas | |
| 3.7 | Selecionar resposta rápida com teclado (setas + Enter) → texto preenche o campo | |
| 3.8 | Clicar no botão Kanban no header do chat → seletor de etapa abre | |
| 3.9 | Mover lead para outra etapa pelo seletor → card aparece na coluna correta no Kanban | |
| 3.10 | Transferir conversa para outro agente → nota de transferência aparece no chat | |
| 3.11 | Agendar mensagem → aparece na lista de agendamentos, é enviada no horário correto | |
| 3.12 | Cancelar agendamento → some da lista, não é enviado | |

---

## 4. Mensagens Interativas

| # | Teste | Resultado |
|---|---|---|
| 4.1 | Abrir painel de mensagens interativas no chat | |
| 4.2 | Criar mensagem com **botões** (até 3) e enviar → botões aparecem no WhatsApp | |
| 4.3 | Criar mensagem com **lista** (seções + itens) e enviar → lista aparece no WhatsApp | |
| 4.4 | Tentar enviar com mais de 3 botões → validação bloqueia | |

---

## 5. Kanban

| # | Teste | Resultado |
|---|---|---|
| 5.1 | Acessar aba **Kanban** → colunas e cards carregam | |
| 5.2 | Arrastar card de uma coluna para outra → persiste ao recarregar a página | |
| 5.3 | Abrir card → modal mostra nome, telefone, valor | |
| 5.4 | Editar valor do lead → salva corretamente | |
| 5.5 | Novo contato envia mensagem → card aparece automaticamente na coluna "Lead" | |
| 5.6 | Clicar "Registrar como venda" → resposta mostra `meta_sent: true` ou `false` | |
| 5.7 | Criar novo funil → aparece na lista de funis | |
| 5.8 | Adicionar etapa ao funil → coluna aparece no Kanban | |

---

## 6. Contatos

| # | Teste | Resultado |
|---|---|---|
| 6.1 | Acessar aba **Contatos** → lista carrega | |
| 6.2 | Buscar por nome ou telefone → filtra em tempo real | |
| 6.3 | Filtrar por tipo (Individual / Grupo) → exibe apenas o tipo selecionado | |
| 6.4 | Filtrar por instância → exibe apenas contatos dessa instância | |
| 6.5 | Salvar filtro com nome → aparece na lista de filtros salvos | |
| 6.6 | Aplicar filtro salvo com 1 clique → filtros são aplicados | |
| 6.7 | Deletar filtro salvo → some da lista | |
| 6.8 | Importar CSV de contatos → contatos aparecem na lista após import | |
| 6.9 | Abrir contato → timeline mostra histórico de eventos | |
| 6.10 | Adicionar campo customizado → salva e aparece no perfil do contato | |
| 6.11 | Adicionar tag ao contato → tag aparece no card da lista | |

---

## 7. Tags e Etiquetas

| # | Teste | Resultado |
|---|---|---|
| 7.1 | Criar tag nova com cor → aparece no gerenciador | |
| 7.2 | Atribuir tag a contato → aparece no card do contato | |
| 7.3 | Filtrar lista de contatos por tag → exibe apenas contatos com aquela tag | |
| 7.4 | Excluir tag → some do gerenciador e dos contatos que a tinham | |

---

## 8. Respostas Rápidas

| # | Teste | Resultado |
|---|---|---|
| 8.1 | Criar resposta rápida com atalho "/oi" e texto | |
| 8.2 | No chat, digitar "/oi" → dropdown sugere a resposta | |
| 8.3 | Selecionar a resposta → preenche o campo de texto | |
| 8.4 | Editar resposta existente → salva corretamente | |
| 8.5 | Excluir resposta → some do dropdown | |

---

## 9. Agendamento de Mensagens

| # | Teste | Resultado |
|---|---|---|
| 9.1 | Agendar mensagem para daqui a 2 minutos → aparece na lista | |
| 9.2 | Aguardar o horário → mensagem é enviada e some da lista | |
| 9.3 | Cancelar agendamento antes do horário → some da lista, não é enviado | |

---

## 10. Broadcast

| # | Teste | Resultado |
|---|---|---|
| 10.1 | Acessar aba **Broadcast** → carrega sem erro | |
| 10.2 | Criar broadcast com segmentação por tag | |
| 10.3 | Enviar broadcast → mensagens chegam nos contatos segmentados | |
| 10.4 | Verificar analytics: total enviado, entregues, lidos | |

---

## 11. Horário de Funcionamento

| # | Teste | Resultado |
|---|---|---|
| 11.1 | Configurar horário de funcionamento por dia da semana | |
| 11.2 | Configurar mensagem de ausência | |
| 11.3 | Enviar mensagem fora do horário → resposta automática de ausência é enviada | |
| 11.4 | Enviar mensagem dentro do horário → nenhuma resposta automática | |

---

## 12. Opt-in / Opt-out (LGPD)

| # | Teste | Resultado |
|---|---|---|
| 12.1 | Fazer opt-out de um contato via API (autenticado) → `opted_in: false` no banco | |
| 12.2 | Tentar fazer opt-out sem estar logado → retorna 401 | |
| 12.3 | Verificar log de opt-out na rota GET `/api/whatsapp/optout` | |

---

## 13. Sequências de Follow-up

| # | Teste | Resultado |
|---|---|---|
| 13.1 | Criar sequência com 2 steps (delay 0h e 1h) | |
| 13.2 | Enrollar um contato na sequência | |
| 13.3 | Step com delay 0h → mensagem enviada imediatamente | |
| 13.4 | Step com delay 1h → mensagem enviada após 1 hora | |
| 13.5 | Cancelar enrollment → sequência para | |

---

## 14. Departamentos

| # | Teste | Resultado |
|---|---|---|
| 14.1 | Acessar aba **Deptos** → lista carrega | |
| 14.2 | Criar departamento → aparece na lista | |
| 14.3 | Expandir departamento → exibe membros | |
| 14.4 | Adicionar agente ao departamento → aparece na lista de membros | |
| 14.5 | Remover agente → some da lista de membros | |
| 14.6 | Excluir departamento → some da lista | |
| 14.7 | Atribuir contato ao departamento via API PATCH | |

---

## 15. Templates HSM (requer META_WABA_ID)

| # | Teste | Resultado |
|---|---|---|
| 15.1 | Acessar aba **Templates** → lista templates aprovados da Meta | |
| 15.2 | Selecionar template, escolher contato e instância, enviar | |
| 15.3 | Mensagem template chega no WhatsApp do contato | |
| 15.4 | Sem META_WABA_ID configurado → exibe aviso em vez de erro 500 | |

---

## 16. Flow Builder (Automações)

| # | Teste | Resultado |
|---|---|---|
| 16.1 | Acessar aba **Flows** → lista carrega | |
| 16.2 | Criar novo flow com trigger por palavra-chave | |
| 16.3 | Adicionar step de mensagem → salva | |
| 16.4 | Adicionar step de tag → salva | |
| 16.5 | Ativar flow → status muda para "ativo" | |
| 16.6 | Enviar a palavra-chave pelo WhatsApp → flow dispara e envia a mensagem | |
| 16.7 | Desativar flow → não dispara mais | |
| 16.8 | Excluir flow → some da lista | |
| 16.9 | Flow com trigger "Primeira mensagem" → dispara na primeira mensagem de novo contato | |

---

## 17. Agente IA

| # | Teste | Resultado |
|---|---|---|
| 17.1 | Acessar aba **IA** → carrega sem erro | |
| 17.2 | Configurar agente com OpenAI key e modelo gpt-4o-mini | |
| 17.3 | Usar botão "Testar" com uma mensagem → recebe resposta da IA | |
| 17.4 | Ativar agente → status ativo | |
| 17.5 | Enviar mensagem pelo WhatsApp → IA responde automaticamente | |
| 17.6 | Digitar palavra de handoff ("humano") → IA para de responder | |
| 17.7 | Desativar agente → para de responder | |

---

## 18. Relatórios e Supervisor

| # | Teste | Resultado |
|---|---|---|
| 18.1 | Acessar aba **Supervisor** → métricas do dia carregam | |
| 18.2 | Tabela de agentes mostra conversas atribuídas e tempo médio | |
| 18.3 | Fila "sem resposta" lista conversas aguardando há mais tempo | |
| 18.4 | Relatório de funil (`/reports/funnel`) mostra taxas de conversão por etapa | |
| 18.5 | CSAT: após encerrar conversa configurada, pesquisa é enviada automaticamente | |

---

## 19. Webhooks de Saída (Zapier/Make)

| # | Teste | Resultado |
|---|---|---|
| 19.1 | Criar webhook de saída com URL de teste (ex: webhook.site) | |
| 19.2 | Disparar evento configurado (ex: nova mensagem) → URL recebe payload | |
| 19.3 | Excluir webhook → para de enviar | |

---

## 20. Widget Embed

| # | Teste | Resultado |
|---|---|---|
| 20.1 | Gerar código embed de uma instância | |
| 20.2 | Colar o código em uma página HTML → botão WhatsApp aparece | |
| 20.3 | Clicar no botão → abre conversa no WhatsApp com o número correto | |

---

## 21. Dashboard de Ads

| # | Teste | Resultado |
|---|---|---|
| 21.1 | Acessar Dashboard principal → métricas Meta Ads carregam | |
| 21.2 | Filtrar por período → gráfico atualiza | |
| 21.3 | Tabela de campanhas exibe dados corretos | |
| 21.4 | Métricas Google Ads carregam (se configurado) | |

---

## 22. Admin

| # | Teste | Resultado |
|---|---|---|
| 22.1 | Convidar novo cliente → recebe e-mail de convite | |
| 22.2 | Vincular conta Meta ao cliente → aparece no dashboard do cliente | |
| 22.3 | Sync manual de dados → não retorna erro | |
| 22.4 | Logs de atividade carregam | |

---

## Resumo

| Módulo | Total | Passaram | Falharam |
|---|---|---|---|
| Autenticação | 5 | | |
| Instâncias | 7 | | |
| Chat | 12 | | |
| Mensagens Interativas | 4 | | |
| Kanban | 8 | | |
| Contatos | 11 | | |
| Tags | 4 | | |
| Respostas Rápidas | 5 | | |
| Agendamento | 3 | | |
| Broadcast | 4 | | |
| Horário de Func. | 4 | | |
| Opt-in/Opt-out | 3 | | |
| Sequências | 5 | | |
| Departamentos | 7 | | |
| Templates HSM | 4 | | |
| Flow Builder | 9 | | |
| Agente IA | 7 | | |
| Relatórios | 5 | | |
| Webhooks Saída | 3 | | |
| Widget Embed | 3 | | |
| Dashboard Ads | 4 | | |
| Admin | 4 | | |
| **TOTAL** | **121** | | |
