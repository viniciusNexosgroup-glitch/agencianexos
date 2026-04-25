import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI!
  )
}

export function getAuthUrl() {
  const client = createOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  })
}

export async function exchangeCode(code: string) {
  const client = createOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getValidTokens(userEmail: string) {
  const supabase = db()
  const { data } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_email', userEmail)
    .maybeSingle()

  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  const needsRefresh = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000

  if (needsRefresh && data.refresh_token) {
    try {
      const client = createOAuth2Client()
      client.setCredentials({ refresh_token: data.refresh_token })
      const { credentials } = await client.refreshAccessToken()
      const updated = {
        access_token: credentials.access_token!,
        expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      }
      await supabase
        .from('google_calendar_tokens')
        .update(updated)
        .eq('user_email', userEmail)
      return { ...data, ...updated }
    } catch {
      return data
    }
  }

  return data
}

export async function createGoogleEvent(
  userEmail: string,
  event: {
    title: string
    description?: string | null
    location?: string | null
    startAt: string
    endAt: string
    allDay?: boolean
  }
): Promise<string | null> {
  const tokens = await getValidTokens(userEmail)
  if (!tokens) return null

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const cal = google.calendar({ version: 'v3', auth: client })
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
  }

  if (event.allDay) {
    const date = event.startAt.slice(0, 10)
    body.start = { date }
    body.end = { date }
  } else {
    body.start = { dateTime: event.startAt, timeZone: 'America/Sao_Paulo' }
    body.end = { dateTime: event.endAt, timeZone: 'America/Sao_Paulo' }
  }

  const res = await cal.events.insert({
    calendarId: 'primary',
    requestBody: body,
  })
  return res.data.id ?? null
}

export async function deleteGoogleEvent(userEmail: string, googleEventId: string) {
  const tokens = await getValidTokens(userEmail)
  if (!tokens) return

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const cal = google.calendar({ version: 'v3', auth: client })
  await cal.events.delete({ calendarId: 'primary', eventId: googleEventId }).catch(() => {})
}

export async function listGoogleCalendars(userEmail: string) {
  const tokens = await getValidTokens(userEmail)
  if (!tokens) return []

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const cal = google.calendar({ version: 'v3', auth: client })
  try {
    const res = await cal.calendarList.list({ minAccessRole: 'reader' })
    return (res.data.items ?? []).filter(c => c.id)
  } catch {
    return []
  }
}

export async function listGoogleEvents(
  userEmail: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string
) {
  const tokens = await getValidTokens(userEmail)
  if (!tokens) return []

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const cal = google.calendar({ version: 'v3', auth: client })
  try {
    const res = await cal.events.list({
      calendarId,
      timeMin: timeMin ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    })
    return res.data.items ?? []
  } catch {
    return []
  }
}

export async function updateGoogleEvent(
  userEmail: string,
  googleEventId: string,
  event: {
    title: string
    description?: string | null
    location?: string | null
    startAt: string
    endAt: string
    allDay?: boolean
  }
) {
  const tokens = await getValidTokens(userEmail)
  if (!tokens) return

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const cal = google.calendar({ version: 'v3', auth: client })
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
  }

  if (event.allDay) {
    const date = event.startAt.slice(0, 10)
    body.start = { date }
    body.end = { date }
  } else {
    body.start = { dateTime: event.startAt, timeZone: 'America/Sao_Paulo' }
    body.end = { dateTime: event.endAt, timeZone: 'America/Sao_Paulo' }
  }

  await cal.events.patch({
    calendarId: 'primary',
    eventId: googleEventId,
    requestBody: body,
  }).catch(() => {})
}
