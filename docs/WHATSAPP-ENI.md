# WhatsApp Business — AMCM ENI

**Número:** +44 7404 796458  
**Deep link:** https://wa.me/447404796458  
**Worker:** `stratamesh-whatsapp` · https://stratamesh-whatsapp.stratamesh.workers.dev  

## Já operacional
- Página https://eni.calhegasmorais.pt/ — contacto WA + botão flutuante
- `/whatsapp` no worker ENI → redirect wa.me
- Worker API: `/health`, `/link`, `/status`, `/send`, `/webhook`
- Inbound webhook → Orquestrador `/chat` (`channel: whatsapp`) → resposta automática quando Cloud API estiver configurada

## Para API Cloud completa (Meta)
1. App em developers.facebook.com → WhatsApp → Cloud API  
2. Secrets no worker `stratamesh-whatsapp`:
   - `WA_ACCESS_TOKEN`
   - `WA_PHONE_NUMBER_ID`
   - `WA_VERIFY_TOKEN` (ex. `amcm-eni-wa-verify`)
3. Webhook URL: `https://stratamesh-whatsapp.stratamesh.workers.dev/webhook`  
4. Subscrever mensagens

Até lá, `cloud_api_configured: false` — envio server-side devolve 503 com deeplink; o sítio e o orquestrador já estão ligados ao canal.
