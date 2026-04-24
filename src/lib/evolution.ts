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
      url: webhookUrl,
      enabled: true,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'GROUPS_UPSERT', 'GROUPS_UPDATE', 'CHATS_UPDATE', 'CHATS_UPSERT'],
    }),
  })
  const data = await res.json()
  console.log('Webhook set response:', JSON.stringify(data))
  return data
}

export async function sendTextMessage(instanceName: string, to: string, text: string) {
  const res = await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: to,
      textMessage: { text },
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

export async function fetchGroupInfo(instanceName: string, groupJid: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, {
      headers: headers(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.subject || data?.name || null
  } catch {
    return null
  }
}

export async function markChatAsRead(instanceName: string, remoteJid: string, lastMessageId: string, fromMe: boolean) {
  try {
    await fetch(`${BASE_URL}/chat/markMessageAsRead/${instanceName}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        readMessages: [{ remoteJid, fromMe, id: lastMessageId }],
      }),
    })
  } catch { /* silencioso */ }
}

export async function sendWhatsAppAudio(instanceName: string, to: string, audioBase64: string) {
  const res = await fetch(`${BASE_URL}/message/sendWhatsAppAudio/${instanceName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: to, audio: audioBase64, encoding: true }),
  })
  return res.json()
}

export async function findMessageById(instanceName: string, remoteJid: string, messageId: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${BASE_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ where: { key: { id: messageId, remoteJid } }, limit: 1 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? (data[0] ?? null) : null
  } catch {
    return null
  }
}

export async function getMediaBase64(
  instanceName: string,
  message: unknown
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.base64) return null
    return { base64: data.base64, mimetype: data.mimetype || 'application/octet-stream' }
  } catch {
    return null
  }
}
