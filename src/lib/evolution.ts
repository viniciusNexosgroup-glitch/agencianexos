const BASE_URL = process.env.EVOLUTION_API_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: API_KEY,
})

export async function createInstance(name: string) {
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })
  return res.json()
}

export async function getInstanceStatus(name: string) {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${name}`, {
    headers: headers(),
  })
  return res.json()
}

export async function getQRCode(name: string) {
  const res = await fetch(`${BASE_URL}/instance/connect/${name}`, {
    headers: headers(),
  })
  return res.json()
}

export async function listInstances() {
  const res = await fetch(`${BASE_URL}/instance/fetchInstances`, {
    headers: headers(),
  })
  return res.json()
}

export async function deleteInstance(name: string) {
  const res = await fetch(`${BASE_URL}/instance/delete/${name}`, {
    method: 'DELETE',
    headers: headers(),
  })
  return res.json()
}

export async function logoutInstance(name: string) {
  const res = await fetch(`${BASE_URL}/instance/logout/${name}`, {
    method: 'DELETE',
    headers: headers(),
  })
  return res.json()
}

export async function setWebhook(instanceName: string, webhookUrl: string) {
  const res = await fetch(`${BASE_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      },
    }),
  })
  return res.json()
}

export async function sendTextMessage(instanceName: string, to: string, text: string) {
  const res = await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: to,
      text,
    }),
  })
  return res.json()
}

export async function fetchMessages(instanceName: string, remoteJid: string, limit = 50) {
  const res = await fetch(`${BASE_URL}/chat/findMessages/${instanceName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ where: { key: { remoteJid } }, limit }),
  })
  return res.json()
}
