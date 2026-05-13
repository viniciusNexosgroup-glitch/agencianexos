# Automacao de Captacao de Leads - n8n

Este repositorio guarda os workflows e o schema de banco da automacao outbound para captacao de leads de escritorios de advocacia.

## Estrutura

- `n8n/01-scraping.json`: busca leads no Google Maps via Apify e salva no Supabase.
- `n8n/02-mensagens.json`: gera e envia a primeira mensagem via WhatsApp.
- `n8n/03-sdr.json`: recebe respostas, interpreta texto/audio/imagem e opera o SDR com agente.
- `n8n/04-calcom-tools.json`: sub-workflow de consulta, criacao e cancelamento de agenda no Cal.com.
- `n8n/05-followup.json`: follow-ups automaticos para leads sem resposta.
- `supabase/setup.sql`: tabelas e indices usados pela automacao.

## Seguranca

As chaves reais nao devem ser commitadas. O arquivo local `CREDENCIAIS.md` fica ignorado pelo Git.

Os workflows usam variaveis de ambiente do n8n:

- `APIFY_TOKEN`
- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `CAL_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EVOLUTION_API_KEY`

Use `.env.local.example` apenas como referencia de nomes.
