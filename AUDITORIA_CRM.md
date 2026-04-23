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

## Configurações manuais (quando quiser ativar no futuro)

Estas funcionalidades já estão implementadas no código. Basta adicionar as variáveis no EasyPanel quando decidir usar:

| Funcionalidade | Variáveis necessárias |
|---|---|
| Templates HSM + Lead Ads + Meta Conversions | `META_WABA_ID`, `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `META_WEBHOOK_VERIFY_TOKEN` |
| Google Ads Conversions | `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CONVERSION_ACTION_ID`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` |

