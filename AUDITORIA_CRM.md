# O que ainda falta fazer

---

## 2 funcionalidades restantes do roadmap

### Multi-tenant / Subcontas (#30)
- RLS (Row Level Security) por `org_id` em todas as tabelas do banco
- Tela de gestão de workspaces (criar, renomear, excluir)
- Convidar usuários por workspace com isolamento real de dados
- Esforço estimado: 4–6 semanas

### Sync Bidirecional HubSpot / RD Station (#31)
- Implementar APIs do HubSpot e RD Station
- Mapeamento de campos entre os CRMs
- Webhooks bidirecionais (mudança no CRM → atualiza aqui e vice-versa)
- Esforço estimado: 4–6 semanas

---

## Configurações manuais necessárias (sem código)

Estas funcionalidades já estão implementadas no código mas precisam de configuração externa para funcionar:

### Templates HSM Meta (#9)
1. No Meta Business Manager, crie e aguarde aprovação de templates
2. No EasyPanel, adicione as variáveis:
   - `META_WABA_ID` — ID da conta WhatsApp Business
   - `META_ACCESS_TOKEN` — Token do sistema (permanente)

### Meta Conversions API (#26)
1. No EasyPanel, adicione:
   - `META_PIXEL_ID` — ID do pixel do Events Manager
   - `META_ACCESS_TOKEN` — mesmo token acima

### Facebook Lead Ads (#25)
1. No EasyPanel, adicione:
   - `META_ACCESS_TOKEN` — mesmo token acima
   - `META_WEBHOOK_VERIFY_TOKEN` — qualquer string secreta que você escolher
   - `META_LEADGEN_WELCOME_MSG` — mensagem de boas-vindas (opcional)
2. No Meta Business Manager → Webhooks:
   - URL: `https://seu-dominio.com/api/meta/leadgen`
   - Verify Token: o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN`
   - Evento: `leadgen`
   - Assinar a página de anúncios

### Google Ads Conversions (#27)
1. No Google Cloud Console, crie credenciais OAuth2
2. No Google Ads, crie uma ação de conversão do tipo "Importar"
3. No EasyPanel, adicione:
   - `GOOGLE_ADS_CUSTOMER_ID`
   - `GOOGLE_ADS_DEVELOPER_TOKEN`
   - `GOOGLE_ADS_CONVERSION_ACTION_ID`
   - `GOOGLE_ADS_REFRESH_TOKEN`
   - `GOOGLE_ADS_CLIENT_ID`
   - `GOOGLE_ADS_CLIENT_SECRET`

