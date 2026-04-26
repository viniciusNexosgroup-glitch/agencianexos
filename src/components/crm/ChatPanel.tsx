'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

type Message = {
  id: string
  message_id?: string | null
  from_me: boolean
  body: string
  timestamp: string
  message_type: string
  participant_name?: string | null
  participant_jid?: string | null
  is_internal?: boolean
  media_url?: string | null
  media_data?: unknown | null
  reactions?: Record<string, string> | null
  status?: number | null
}

type Contact = {
  id: string
  name: string
  phone: string
  instance_name: string
  remote_jid?: string | null
}

type Lead = {
  id: string
  stage_id: string
  contact_id: string
}

type Agent = { id: string; name: string; email: string }

type InteractiveButton = { id: string; text: string }
type InteractiveListItem = { id: string; title: string; description?: string }
type InteractiveSection = { title: string; rows: InteractiveListItem[] }

type QuickReply = {
  id: string
  shortcut: string
  content: string
  type: 'text' | 'audio'
}

type ScheduledMessage = {
  id: string
  body: string
  send_at: string
  status: string
}

const AVATAR_COLORS = [
  'bg-teal-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
  'bg-orange-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-rose-600',
]

const SENDER_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a',
]

function senderColor(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Status: 0=erro 1=pendente 2=enviado(server) 3=entregue 4=lido 5=reproduzido(áudio)
function MsgStatus({ status }: { status?: number | null }) {
  const blue = '#53bdeb'
  const gray = '#8aaabf'

  // Lido / Reproduzido → duplo check azul
  if (status === 4 || status === 5) {
    return (
      <svg className="inline-block ml-1 flex-shrink-0" width="18" height="12" viewBox="0 0 18 12" fill={blue}>
        <path d="M17.394 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z"/>
        <path d="M12.334 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z" opacity=".5"/>
      </svg>
    )
  }

  // Entregue → duplo check cinza
  if (status === 3) {
    return (
      <svg className="inline-block ml-1 flex-shrink-0" width="18" height="12" viewBox="0 0 18 12" fill={gray}>
        <path d="M17.394 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z"/>
        <path d="M12.334 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z" opacity=".5"/>
      </svg>
    )
  }

  // Enviado ao servidor → check simples cinza
  if (status === 2) {
    return (
      <svg className="inline-block ml-1 flex-shrink-0" width="12" height="12" viewBox="0 0 12 12" fill={gray}>
        <path d="M11.394 1.556a.75.75 0 0 0-1.06-1.06l-6.07 6.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l6.601-6.6z"/>
      </svg>
    )
  }

  // Pendente → relógio
  if (status === 1) {
    return (
      <svg className="inline-block ml-1 flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={gray} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    )
  }

  // Padrão (status null/0/desconhecido após envio nosso) → duplo check cinza
  return (
    <svg className="inline-block ml-1 flex-shrink-0" width="18" height="12" viewBox="0 0 18 12" fill={gray}>
      <path d="M17.394 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z"/>
      <path d="M12.334 1.556a.75.75 0 0 0-1.06-1.06l-7.07 7.07-1.415-1.414a.75.75 0 0 0-1.06 1.06l1.944 1.944a.75.75 0 0 0 1.06 0l7.601-7.6z" opacity=".5"/>
    </svg>
  )
}

function parseVCard(vcard: string): { name: string; phone: string; org: string } {
  const lines = vcard.split(/\r?\n/)
  let name = '', phone = '', org = ''
  for (const line of lines) {
    if (line.startsWith('FN:')) name = line.slice(3).trim()
    else if (line.startsWith('ORG:')) org = line.slice(4).replace(/;/g, ' ').trim()
    else if (line.startsWith('TEL')) {
      const waid = line.match(/waid=(\d+)/)
      if (waid) phone = waid[1]
      else {
        const colon = line.lastIndexOf(':')
        if (colon !== -1) phone = line.slice(colon + 1).replace(/[^\d+]/g, '')
      }
    }
  }
  return { name, phone, org }
}

function ContactCard({
  displayName,
  vcard,
  fromMe,
  instanceName,
  onConverse,
}: {
  displayName: string
  vcard: string
  fromMe: boolean
  instanceName: string
  onConverse?: (phone: string, instance: string) => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const parsed = parseVCard(vcard)
  const name = parsed.name || displayName || 'Contato'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const bg = AVATAR_COLORS[Math.abs(name.split('').reduce((h: number, c: string) => c.charCodeAt(0) + ((h << 5) - h), 0)) % AVATAR_COLORS.length]

  return (
    <div className={`rounded-xl overflow-hidden min-w-[220px] max-w-[260px] ${fromMe ? 'bg-[#1f5c37]' : 'bg-[#202c33]'}`}>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${bg}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {parsed.org && <p className="text-[#8696a0] text-xs truncate">{parsed.org}</p>}
          {parsed.phone && <p className="text-[#8696a0] text-xs">{parsed.phone}</p>}
        </div>
      </div>
      <div className={`border-t ${fromMe ? 'border-[#1a7a42]' : 'border-[#2a3942]'} flex`}>
        <button
          onClick={() => parsed.phone && onConverse?.(parsed.phone, instanceName)}
          disabled={!parsed.phone}
          className={`flex-1 text-center py-2 text-xs font-medium transition ${parsed.phone ? 'text-[#00a884] hover:bg-[#ffffff10]' : 'text-[#8696a0]'}`}
        >
          Conversar
        </button>
        <div className={`w-px ${fromMe ? 'bg-[#1a7a42]' : 'bg-[#2a3942]'}`} />
        <button
          onClick={() => setShowDetails(v => !v)}
          className="flex-1 text-center py-2 text-[#00a884] text-xs font-medium hover:bg-[#ffffff10] transition"
        >
          {showDetails ? 'Ocultar' : 'Ver detalhes'}
        </button>
      </div>
      {showDetails && (
        <div className={`px-3 py-2 border-t ${fromMe ? 'border-[#1a7a42]' : 'border-[#2a3942]'}`}>
          <pre className="text-[10px] text-[#8696a0] whitespace-pre-wrap break-all leading-4">{vcard}</pre>
        </div>
      )}
    </div>
  )
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.messages.push(msg)
    } else {
      groups.push({ date, messages: [msg] })
    }
  }
  return groups
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi

function renderMessageText(text: string, query: string) {
  const segments = text.split(URL_REGEX)
  return (
    <>
      {segments.map((seg, i) => {
        if (URL_REGEX.test(seg)) {
          URL_REGEX.lastIndex = 0
          return (
            <a
              key={i}
              href={seg}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#53bdeb] hover:text-[#7dcef5] break-all"
              onClick={e => e.stopPropagation()}
            >
              {seg}
            </a>
          )
        }
        if (!query.trim()) return <span key={i}>{seg}</span>
        const parts = seg.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
        return (
          <span key={i}>
            {parts.map((part, j) =>
              part.toLowerCase() === query.toLowerCase()
                ? <mark key={j} className="bg-yellow-400 text-black rounded-sm px-0.5">{part}</mark>
                : part
            )}
          </span>
        )
      })}
    </>
  )
}

function VideoPlayer({
  thumbnail,
  messageId,
  instance,
}: {
  thumbnail: string
  messageId: string
  instance: string
}) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return () => { if (videoSrc) URL.revokeObjectURL(videoSrc) }
  }, [videoSrc])

  async function openModal() {
    setModalOpen(true)
    if (videoSrc) return
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ instance, message_id: messageId })
      const res = await fetch(`/api/whatsapp/media-video?${params}`)
      if (!res.ok) { setError(true); return }
      const blob = await res.blob()
      setVideoSrc(URL.createObjectURL(blob))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    videoRef.current?.pause()
  }

  function toggleFullscreen() {
    if (!videoRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoRef.current.requestFullscreen?.()
    }
  }

  return (
    <>
      {/* Thumbnail no chat */}
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer mb-1 group"
        style={{ width: 240, height: 180 }}
        onClick={openModal}
      >
        {/* Fundo escuro sempre presente (fallback visível quando thumbnail falha) */}
        <div className="absolute inset-0 bg-[#111c22] flex items-center justify-center">
          <svg className="w-12 h-12 text-[#2a3942]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </div>
        {/* Thumbnail sobre o fundo */}
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        {/* Overlay escuro + botão play */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/55 border border-white/20 flex items-center justify-center shadow-xl backdrop-blur-sm group-hover:scale-105 transition-transform">
            <svg className="w-8 h-8 text-white drop-shadow-lg" style={{ marginLeft: 3 }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        {/* Badge câmera (canto inferior esquerdo) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5 backdrop-blur-sm">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
          <span className="text-white text-[10px] font-medium">Vídeo</span>
        </div>
      </div>

      {/* Modal de vídeo */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="relative flex flex-col items-center"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Controles superiores */}
            <div className="flex items-center justify-between w-full px-2 pb-3">
              <span className="text-white/60 text-xs">Vídeo</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white transition p-1"
                  title="Tela cheia"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                  </svg>
                </button>
                <button
                  onClick={closeModal}
                  className="text-white/70 hover:text-white transition p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Player */}
            <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl" style={{ minWidth: 280 }}>
              {loading && (
                <div className="flex items-center justify-center" style={{ width: 320, height: 240 }}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin"/>
                    <span className="text-white/60 text-sm">Carregando vídeo...</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="flex items-center justify-center" style={{ width: 320, height: 200 }}>
                  <div className="flex flex-col items-center gap-2 px-6 text-center">
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-white/60 text-sm">Não foi possível carregar o vídeo</span>
                    <button
                      onClick={() => { setError(false); setVideoSrc(null); openModal() }}
                      className="text-[#00a884] text-sm hover:underline mt-1"
                    >Tentar novamente</button>
                  </div>
                </div>
              )}
              {videoSrc && !error && (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="block"
                  style={{ maxWidth: '85vw', maxHeight: '75vh' }}
                  src={videoSrc}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

let currentlyPlayingAudio: HTMLAudioElement | null = null

function AudioPlayer({ src, fromMe }: { src: string; fromMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const bars = useMemo(() => {
    let seed = 0
    for (let i = 0; i < Math.min(src.length, 40); i++) seed += src.charCodeAt(i)
    return Array.from({ length: 32 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return 20 + (seed % 80)
    })
  }, [src])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      if (currentlyPlayingAudio && currentlyPlayingAudio !== audio) {
        currentlyPlayingAudio.pause()
      }
      audio.play()
    }
  }

  function formatDur(s: number) {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const playedBars = Math.floor(progress * bars.length)

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: '220px', maxWidth: '260px' }}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => { setPlaying(true); currentlyPlayingAudio = audioRef.current }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
        style={{ backgroundColor: fromMe ? '#ffffff25' : '#00a88430' }}
      >
        {playing ? (
          <svg className="w-4 h-4 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-[2px] h-7">
          {bars.map((h, i) => (
            <div
              key={i}
              className="rounded-full transition-colors duration-100"
              style={{
                flex: 1,
                height: `${h}%`,
                minWidth: '2px',
                maxWidth: '4px',
                backgroundColor: i < playedBars
                  ? '#00a884'
                  : fromMe ? '#ffffff55' : '#8696a0',
              }}
            />
          ))}
        </div>
        <p className="text-[10px] text-[#8696a0] leading-none">
          {formatDur(playing || currentTime > 0 ? currentTime : duration)}
        </p>
      </div>
    </div>
  )
}

export function ChatPanel({
  contact,
  onClose,
  funnels,
  onOpenContact,
}: {
  contact: Contact
  onClose: () => void
  funnels?: { id: string; name: string; crm_stages: { id: string; name: string }[] }[]
  onOpenContact?: (phone: string, instanceName: string) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Quick Replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrSelected, setQrSelected] = useState(0)
  const quickRepliesRef = useRef<HTMLDivElement>(null)

  // Notas internas
  const [isInternal, setIsInternal] = useState(false)

  // Agendamento
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)

  // Busca no histórico
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Etapa do funil
  const [lead, setLead] = useState<Lead | null>(null)
  const [showStageDropdown, setShowStageDropdown] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)
  const stageDropdownRef = useRef<HTMLDivElement>(null)

  // Transferência de conversa
  const [showTransfer, setShowTransfer] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [transferTo, setTransferTo] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Gravação de áudio
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sendingAudio, setSendingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Perfil do participante (grupos)
  type ProfileLead = { id: string; title: string; value: number | null; notes: string | null; contact_id: string }
  type ParticipantProfile = {
    name: string
    phone: string
    jid: string
    loading: boolean
    contact: { id: string; name: string; phone: string; instance_name: string; profile_pic_url?: string | null; remote_jid?: string | null } | null
    lead: ProfileLead | null
    leadLoading: boolean
  }
  const [profilePanel, setProfilePanel] = useState<ParticipantProfile | null>(null)
  const [profileLeadTitle, setProfileLeadTitle] = useState('')
  const [profileLeadValue, setProfileLeadValue] = useState('0')
  const [profileLeadNotes, setProfileLeadNotes] = useState('')
  const [savingProfileLead, setSavingProfileLead] = useState(false)
  const [markingWonProfile, setMarkingWonProfile] = useState(false)
  const [wonSuccessProfile, setWonSuccessProfile] = useState(false)
  const [profileSaleValue, setProfileSaleValue] = useState('0')
  const [markingDirectSale, setMarkingDirectSale] = useState(false)
  const [directSaleSuccess, setDirectSaleSuccess] = useState(false)

  // Mensagens interativas
  const [showInteractive, setShowInteractive] = useState(false)
  const [interactiveTab, setInteractiveTab] = useState<'buttons' | 'list'>('buttons')
  const [iTitle, setITitle] = useState('')
  const [iBody, setIBody] = useState('')
  const [iFooter, setIFooter] = useState('')
  const [iButtons, setIButtons] = useState<InteractiveButton[]>([{ id: '1', text: '' }, { id: '2', text: '' }])
  const [iListBtn, setIListBtn] = useState('')
  const [iSections, setISections] = useState<InteractiveSection[]>([{ title: '', rows: [{ id: '1', title: '' }] }])
  const [sendingInteractive, setSendingInteractive] = useState(false)

  // Sidebar de templates
  const [templatesSidebar, setTemplatesSidebar] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateVideoId, setTemplateVideoId] = useState<string | null>(null)
  const [templateVideoUrl, setTemplateVideoUrl] = useState('')
  const [sendingTemplateVideo, setSendingTemplateVideo] = useState(false)

  // Gerenciador de respostas rápidas
  const [showQRManager, setShowQRManager] = useState(false)
  const [newQRTab, setNewQRTab] = useState<'text' | 'audio'>('text')
  const [newQRShortcut, setNewQRShortcut] = useState('')
  const [newQRContent, setNewQRContent] = useState('')
  const [savingQR, setSavingQR] = useState(false)
  const [deletingQR, setDeletingQR] = useState<string | null>(null)
  const [recordingQR, setRecordingQR] = useState(false)
  const [recordingQRSeconds, setRecordingQRSeconds] = useState(0)
  const [pendingQRAudio, setPendingQRAudio] = useState<string | null>(null)
  const qrMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const qrAudioChunksRef = useRef<Blob[]>([])
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ações de mensagem (reply, forward, react, delete)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null)
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [forwardSearch, setForwardSearch] = useState('')
  const [forwardContacts, setForwardContacts] = useState<{ id: string; name: string; phone: string; instance_name: string; remote_jid?: string | null }[]>([])
  const [forwardingTo, setForwardingTo] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [forwardSuccess, setForwardSuccess] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha painel de perfil ao trocar de conversa
  useEffect(() => {
    setProfilePanel(null)
    setReplyingTo(null)
  }, [contact.id])

  useEffect(() => {
    setMessages([])
    setLoading(true)
    setError(null)
    load()
    loadLead()
    loadCurrentAgent()

    // Realtime: nova mensagem aparece instantaneamente
    const sb = createBrowserClient()
    const channel = sb
      .channel(`messages-${contact.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `contact_id=eq.${contact.id}`,
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          setMessages(prev => {
            const msg = payload.new as Message
            if (prev.some(m => m.id === msg.id)) return prev
            // Substitui mensagem otimista (sem message_id real) pelo registro real do banco
            // Evita duplicata sem precisar de setTimeout(load)
            if (msg.from_me) {
              const optimIdx = prev.findIndex(m =>
                m.from_me && m.message_type === msg.message_type && !m.message_id
              )
              if (optimIdx >= 0) {
                return prev.map((m, i) => i === optimIdx ? { ...m, id: msg.id, message_id: msg.message_id, status: msg.status } : m)
              }
            }
            return [...prev, msg]
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `contact_id=eq.${contact.id}`,
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const updated = payload.new as Message
          setMessages(prev => prev.map(m =>
            m.id === updated.id
              ? { ...m, reactions: updated.reactions, media_url: updated.media_url, message_type: updated.message_type, body: updated.body ?? m.body, media_data: updated.media_data ?? m.media_data, status: updated.status ?? m.status }
              : m
          ))
        }
      })
      .subscribe()

    // Loop de polling como fallback (Realtime é primário; poll só adiciona msgs que não chegaram via socket)
    const POLL_SELECT_FULL = 'id, message_id, from_me, body, timestamp, message_type, participant_name, participant_jid, is_internal, media_url, media_data, reactions, status'
    const POLL_SELECT_BASE = 'id, message_id, from_me, body, timestamp, message_type, participant_name, participant_jid, is_internal, media_url, media_data, reactions'
    let active = true
    async function pollLoop() {
      while (active) {
        await new Promise(r => setTimeout(r, 4000))
        if (!active) break
        try {
          const sb2 = createBrowserClient()
          let { data } = await sb2
            .from('whatsapp_messages')
            .select(POLL_SELECT_FULL)
            .eq('contact_id', contact.id)
            .order('timestamp', { ascending: false })
            .limit(50)
          if (!data) {
            const res = await sb2
              .from('whatsapp_messages')
              .select(POLL_SELECT_BASE)
              .eq('contact_id', contact.id)
              .order('timestamp', { ascending: false })
              .limit(50)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data = res.data as any
          }
          if (data) {
            const latest = (data as Message[]).reverse()
            // Merge: adiciona apenas mensagens novas, preserva antigas (carregadas via loadMore)
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              const newOnes = latest.filter(m => !existingIds.has(m.id))
              if (newOnes.length === 0) return prev
              return [...prev, ...newOnes].sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
            })
          }
        } catch { /* silencioso */ }
      }
    }
    pollLoop()

    return () => {
      active = false
      sb.removeChannel(channel)
    }
  }, [contact.id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setShowStageDropdown(false)
      }
    }
    if (showStageDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showStageDropdown])

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: loading ? 'instant' : 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  useEffect(() => {
    if (showSchedule) {
      loadScheduled()
    }
  }, [showSchedule, contact.id])

  // Fechar dropdown de quick replies ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false)
      }
    }
    if (showQuickReplies) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showQuickReplies])

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    if (showEmoji) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  // Fechar menu de mensagem ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuMsgId(null)
        setReactionMsgId(null)
      }
    }
    if (menuMsgId || reactionMsgId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuMsgId, reactionMsgId])

  async function load() {
    const supabase = createBrowserClient()
    const BASE_SELECT = 'id, message_id, from_me, body, timestamp, message_type, participant_name, participant_jid, is_internal, media_url, media_data, reactions'
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(`${BASE_SELECT}, status`)
        .eq('contact_id', contact.id)
        .order('timestamp', { ascending: false })
        .limit(50)
      if (error) {
        // Fallback: coluna status pode não existir ainda (rodar: ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS status INTEGER)
        const { data: data2, error: error2 } = await supabase
          .from('whatsapp_messages')
          .select(BASE_SELECT)
          .eq('contact_id', contact.id)
          .order('timestamp', { ascending: false })
          .limit(50)
        if (error2) throw error2
        isAtBottomRef.current = true
        const msgs = (data2 ?? []).reverse()
        setMessages(msgs)
        setHasMore((data2?.length ?? 0) === 50)
      } else {
        isAtBottomRef.current = true
        const msgs = (data ?? []).reverse()
        setMessages(msgs)
        setHasMore((data?.length ?? 0) === 50)
      }
      setLoading(false)
    } catch (err) {
      console.error('[CRM] Erro ao carregar mensagens:', err)
      setLoading(false)
    }
  }

  async function loadMore() {
    const oldest = messages[0]
    if (!oldest || loadingMore || !hasMore) return
    setLoadingMore(true)
    const supabase = createBrowserClient()
    const BASE_SELECT = 'id, message_id, from_me, body, timestamp, message_type, participant_name, participant_jid, is_internal, media_url, media_data, reactions'
    try {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select(`${BASE_SELECT}, status`)
        .eq('contact_id', contact.id)
        .lt('timestamp', oldest.timestamp)
        .order('timestamp', { ascending: false })
        .limit(50)
      const older = (data ?? []).reverse()
      // Preserva posição de scroll: calcula altura antes e restaura depois
      const el = scrollContainerRef.current
      const prevScrollBottom = el ? el.scrollHeight - el.scrollTop : 0
      setMessages(prev => [...older, ...prev])
      setHasMore((data?.length ?? 0) === 50)
      if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevScrollBottom })
    } catch (err) {
      console.error('[CRM] Erro ao carregar mensagens anteriores:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  async function loadLead() {
    try {
      const res = await fetch(`/api/whatsapp/leads?contact_id=${contact.id}`)
      const data = await res.json()
      setLead(data.lead ?? null)
    } catch {
      setLead(null)
    }
  }

  async function loadCurrentAgent() {
    try {
      const res = await fetch(`/api/whatsapp/transfers?contact_id=${contact.id}`)
      const data = await res.json()
      setCurrentAgent(data.current_agent ?? null)
    } catch {
      setCurrentAgent(null)
    }
  }

  async function loadAgents() {
    if (agents.length > 0) return
    const res = await fetch('/api/whatsapp/agents')
    const data = await res.json()
    setAgents(data.agents ?? [])
  }

  async function loadForwardContacts() {
    try {
      const res = await fetch('/api/whatsapp/contacts?limit=100')
      const d = await res.json()
      setForwardContacts(d.contacts ?? [])
    } catch { setForwardContacts([]) }
  }

  async function handleReact(msg: Message, emoji: string) {
    setReactionMsgId(null)
    setMenuMsgId(null)
    if (!msg.message_id) return
    const remoteJid = contact.remote_jid || `${contact.phone}@s.whatsapp.net`
    // Optimistic: atualiza reactions localmente
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m
      const reactions = { ...(m.reactions || {}), me: emoji }
      return { ...m, reactions }
    }))
    await fetch('/api/whatsapp/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_name: contact.instance_name,
        remote_jid: remoteJid,
        message_id: msg.message_id,
        from_me: msg.from_me,
        participant_jid: msg.participant_jid || null,
        emoji,
      }),
    })
  }

  async function handleDeleteForMe(msg: Message) {
    setDeletingMsg(true)
    setDeleteTarget(null)
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    const remoteJid = contact.remote_jid || `${contact.phone}@s.whatsapp.net`
    await fetch('/api/whatsapp/delete-message', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: msg.id,
        message_id: msg.message_id,
        instance_name: contact.instance_name,
        remote_jid: remoteJid,
        from_me: msg.from_me,
        // Apagar para mim: se a mensagem foi enviada por mim, remove do WhatsApp também
        for_everyone: msg.from_me && !!msg.message_id,
      }),
    })
    setDeletingMsg(false)
  }

  async function handleDeleteForAll(msg: Message) {
    setDeletingMsg(true)
    setDeleteTarget(null)
    // Marca como apagada no estado (igual WhatsApp — mensagem permanece visível como "Mensagem apagada")
    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, message_type: 'revoked', body: '', media_url: null, media_data: null } : m
    ))
    const remoteJid = contact.remote_jid || `${contact.phone}@s.whatsapp.net`
    await fetch('/api/whatsapp/delete-message', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: msg.id,
        message_id: msg.message_id,
        instance_name: contact.instance_name,
        remote_jid: remoteJid,
        from_me: msg.from_me,
        for_everyone: true,
      }),
    })
    setDeletingMsg(false)
  }

  async function handleForward(targetContact: { id: string; name: string; phone: string; instance_name: string; remote_jid?: string | null }) {
    if (!forwardMsg || forwardingTo) return
    setForwardingTo(targetContact.id)
    const to = targetContact.remote_jid || targetContact.phone
    try {
      const isMidia = ['imageMessage','audioMessage','videoMessage','stickerMessage','ptvMessage'].includes(forwardMsg.message_type)

      if (isMidia && forwardMsg.media_url?.startsWith('data:')) {
        // Encaminhar mídia com base64 via Evolution API
        const mime = forwardMsg.media_url.split(';')[0].replace('data:', '')
        const base64 = forwardMsg.media_url.split(',')[1]
        const mediaType = forwardMsg.message_type === 'audioMessage' || forwardMsg.message_type === 'ptvMessage'
          ? 'audio' : forwardMsg.message_type === 'imageMessage' ? 'image' : 'video'
        await fetch(`/api/whatsapp/send-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: targetContact.instance_name,
            contactId: targetContact.id,
            phone: to,
            mediatype: mediaType,
            mimetype: mime,
            media: base64,
            caption: forwardMsg.body || '',
          }),
        })
      } else {
        // Texto puro ou mídia sem base64 armazenado
        const text = forwardMsg.body || (isMidia ? '[Mídia encaminhada]' : '')
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: targetContact.instance_name,
            contactId: targetContact.id,
            phone: to,
            text,
          }),
        })
      }

      setForwardMsg(null)
      setForwardSearch('')
      setForwardSuccess(`Mensagem encaminhada para ${targetContact.name || targetContact.phone}`)
      setTimeout(() => setForwardSuccess(null), 3000)
    } catch {
      setForwardSuccess('Erro ao encaminhar mensagem')
      setTimeout(() => setForwardSuccess(null), 3000)
    } finally {
      setForwardingTo(null)
    }
  }

  async function transfer() {
    if (!transferTo || transferring) return
    setTransferring(true)
    await fetch('/api/whatsapp/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, to_agent_id: transferTo, note: transferNote }),
    })
    setTransferring(false)
    setShowTransfer(false)
    setTransferNote('')
    await loadCurrentAgent()
  }

  async function sendInteractive() {
    if (sendingInteractive) return
    setSendingInteractive(true)
    try {
      const body: Record<string, unknown> = {
        type: interactiveTab,
        instanceName: contact.instance_name,
        contactId: contact.id,
        phone: contact.remote_jid || contact.phone,
        title: iTitle,
        body: iBody,
        footer: iFooter,
      }
      if (interactiveTab === 'buttons') {
        body.buttons = iButtons.filter(b => b.text.trim())
      } else {
        body.buttonText = iListBtn || 'Ver opções'
        body.sections = iSections.map(s => ({
          title: s.title,
          rows: s.rows.filter(r => r.title.trim()).map(r => ({
            rowId: r.id,
            title: r.title,
            description: r.description || '',
          })),
        })).filter(s => s.rows.length > 0)
      }
      const res = await fetch('/api/whatsapp/interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setError(data.error) } else {
        setShowInteractive(false)
        setITitle(''); setIBody(''); setIFooter(''); setIListBtn('')
        setIButtons([{ id: '1', text: '' }, { id: '2', text: '' }])
        setISections([{ title: '', rows: [{ id: '1', title: '' }] }])
        setTimeout(load, 1500)
      }
    } finally {
      setSendingInteractive(false)
    }
  }

  async function updateStage(stageId: string) {
    if (updatingStage) return
    setUpdatingStage(true)
    try {
      const funnel = funnels?.find(f => f.crm_stages.some(s => s.id === stageId))
      const res = await fetch('/api/whatsapp/leads', {
        method: lead ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          lead
            ? { id: lead.id, stageId, funnelId: funnel?.id }
            : { contactId: contact.id, stageId, funnelId: funnel?.id, title: contact.name || 'Lead' }
        ),
      })
      const data = await res.json()
      if (data.lead) setLead(data.lead)
    } finally {
      setUpdatingStage(false)
      setShowStageDropdown(false)
    }
  }

  async function loadQuickReplies() {
    setQrLoading(true)
    try {
      const res = await fetch('/api/whatsapp/quick-replies')
      const data = await res.json()
      setQuickReplies(data.quickReplies ?? data ?? [])
    } catch {
      setQuickReplies([])
    } finally {
      setQrLoading(false)
    }
  }

  async function loadScheduled() {
    setLoadingScheduled(true)
    try {
      const res = await fetch(`/api/whatsapp/scheduled?contact_id=${contact.id}`)
      const data = await res.json()
      setScheduledMessages(data.scheduled ?? [])
    } catch {
      setScheduledMessages([])
    } finally {
      setLoadingScheduled(false)
    }
  }

  async function cancelScheduled(id: string) {
    await fetch(`/api/whatsapp/scheduled?id=${id}`, { method: 'DELETE' })
    setScheduledMessages(prev => prev.filter(s => s.id !== id))
  }

  async function scheduleMessage() {
    if (!text.trim() || !scheduleAt || scheduling) return
    setScheduling(true)
    try {
      const res = await fetch('/api/whatsapp/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          instance_name: contact.instance_name,
          body: text.trim(),
          send_at: new Date(scheduleAt).toISOString(),
        }),
      })
      const data = await res.json()
      if (!data.error) {
        setText('')
        setScheduleAt('')
        setShowSchedule(false)
        await loadScheduled()
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao agendar mensagem.')
    } finally {
      setScheduling(false)
    }
  }

  async function send() {
    if (!text.trim() || sending) return
    const body = text.trim()
    const quotedMsg = replyingTo
    setSending(true)
    setError(null)
    setText('')
    setReplyingTo(null)
    isAtBottomRef.current = true

    const optimistic: Message = {
      id: crypto.randomUUID(),
      from_me: true,
      body,
      timestamp: new Date().toISOString(),
      message_type: 'text',
      is_internal: isInternal,
      media_data: quotedMsg ? { _reply: { id: quotedMsg.message_id, body: quotedMsg.body, sender_name: quotedMsg.from_me ? 'Você' : (contact.name || contact.phone), from_me: quotedMsg.from_me } } : undefined,
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const remoteJid = contact.remote_jid || contact.phone
      const payload: Record<string, unknown> = {
        instanceName: contact.instance_name,
        contactId: contact.id,
        phone: remoteJid,
        text: body,
        is_internal: isInternal,
      }
      if (quotedMsg?.message_id) {
        payload.quoted = {
          key: { remoteJid, fromMe: quotedMsg.from_me, id: quotedMsg.message_id },
          message: { conversation: quotedMsg.body || '' },
        }
      }
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setText(body)
      } else {
        // Substitui a mensagem otimista pelo ID real do banco para evitar duplicata via realtime
        if (result.id) {
          setMessages(prev => prev.map(m =>
            m.id === optimistic.id ? { ...m, id: result.id, message_id: result.message_id ?? m.message_id } : m
          ))
        }
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(body)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Navegar no dropdown de quick replies
    if (showQuickReplies) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setQrSelected(s => Math.min(s + 1, filteredQR.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setQrSelected(s => Math.max(s - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredQR[qrSelected]) selectQuickReply(filteredQR[qrSelected])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowQuickReplies(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)

    if (val === '/' || val.startsWith('/')) {
      if (!showQuickReplies) {
        setShowQuickReplies(true)
        setQrSelected(0)
        if (quickReplies.length === 0) loadQuickReplies()
      }
    } else {
      setShowQuickReplies(false)
    }
  }

  function selectQuickReply(qr: QuickReply) {
    setText(qr.content)
    setShowQuickReplies(false)
    setQrSelected(0)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const len = qr.content.length
        inputRef.current.setSelectionRange(len, len)
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 128) + 'px'
      }
    }, 0)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result as string
          const base64 = dataUrl.split(',')[1]

          // Mensagem otimista: aparece imediatamente no chat
          isAtBottomRef.current = true
          const optimistic: Message = {
            id: crypto.randomUUID(),
            from_me: true,
            body: '',
            timestamp: new Date().toISOString(),
            message_type: 'audioMessage',
            media_url: dataUrl,
            is_internal: false,
          }
          setMessages(prev => [...prev, optimistic])

          setSendingAudio(true)
          try {
            const res = await fetch('/api/whatsapp/send-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName: contact.instance_name,
                phone: contact.remote_jid || contact.phone,
                audio: base64,
              }),
            })
            const data = await res.json()
            if (data.error) {
              setError('Erro ao enviar áudio: ' + data.error)
              setMessages(prev => prev.filter(m => m.id !== optimistic.id))
            }
            // realtime INSERT irá substituir o otimista quando o webhook salvar no banco
          } catch {
            setError('Erro de conexão ao enviar áudio.')
            setMessages(prev => prev.filter(m => m.id !== optimistic.id))
          } finally {
            setSendingAudio(false)
          }
        }
        reader.readAsDataURL(blob)
      }
      mr.start()
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      setError('Permissão de microfone necessária.')
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setRecordingSeconds(0)
  }

  function cancelRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    setRecordingSeconds(0)
  }

  async function openParticipantProfile(name: string, jid: string) {
    const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '')
    setProfilePanel({ name, phone, jid, contact: null, lead: null, loading: true, leadLoading: true })
    setProfileLeadTitle('')
    setProfileLeadValue('0')
    setProfileLeadNotes('')
    setProfileSaleValue('0')
    setDirectSaleSuccess(false)
    try {
      const sb = createBrowserClient()
      const { data: contactData } = await sb
        .from('whatsapp_contacts')
        .select('id, name, phone, instance_name, profile_pic_url, remote_jid')
        .eq('instance_name', contact.instance_name)
        .eq('phone', phone)
        .maybeSingle()
      setProfilePanel(prev => prev ? { ...prev, contact: contactData ?? null, loading: false } : null)

      if (contactData?.id) {
        const { data: leadData } = await sb
          .from('crm_leads')
          .select('id, title, value, notes, contact_id')
          .eq('contact_id', contactData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setProfilePanel(prev => prev ? { ...prev, lead: leadData ?? null, leadLoading: false } : null)
        if (leadData) {
          setProfileLeadTitle(leadData.title ?? '')
          setProfileLeadValue(String(leadData.value ?? 0))
          setProfileLeadNotes(leadData.notes ?? '')
        }
      } else {
        setProfilePanel(prev => prev ? { ...prev, leadLoading: false } : null)
      }
    } catch {
      setProfilePanel(prev => prev ? { ...prev, loading: false, leadLoading: false } : null)
    }
  }

  async function sendQuickReply(qr: QuickReply) {
    setShowQRManager(false)
    if (qr.type === 'audio' || qr.content.startsWith('data:audio')) {
      const base64 = qr.content.split(',')[1]
      const optimistic: Message = {
        id: crypto.randomUUID(),
        from_me: true,
        body: '',
        timestamp: new Date().toISOString(),
        message_type: 'audioMessage',
        media_url: qr.content,
      }
      setMessages(prev => [...prev, optimistic])
      try {
        const res = await fetch('/api/whatsapp/send-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: contact.instance_name, phone: contact.remote_jid || contact.phone, audio: base64 }),
        })
        const data = await res.json()
        if (data.error) {
          setError('Erro ao enviar áudio: ' + data.error)
          setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        }
        // realtime INSERT irá substituir o otimista quando o webhook salvar no banco
      } catch {
        setError('Erro de conexão ao enviar áudio.')
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      }
    } else {
      const body = qr.content
      setSending(true)
      const optimistic: Message = {
        id: crypto.randomUUID(),
        from_me: true,
        body,
        timestamp: new Date().toISOString(),
        message_type: 'text',
      }
      setMessages(prev => [...prev, optimistic])
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: contact.instance_name, contactId: contact.id, phone: contact.remote_jid || contact.phone, text: body }),
        })
        const result = await res.json()
        if (result.error) {
          setError(result.error)
          setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        } else if (result.id) {
          setMessages(prev => prev.map(m =>
            m.id === optimistic.id ? { ...m, id: result.id, message_id: result.message_id ?? m.message_id } : m
          ))
        }
      } catch {
        setError('Erro de conexão.')
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      } finally {
        setSending(false)
      }
    }
  }

  async function saveQuickReply() {
    const shortcut = newQRShortcut.trim()
    const content = newQRTab === 'audio' ? (pendingQRAudio || '') : newQRContent.trim()
    if (!shortcut || !content) return
    setSavingQR(true)
    try {
      const res = await fetch('/api/whatsapp/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcut, content, type: newQRTab }),
      })
      const data = await res.json()
      if (data.quickReply) {
        setQuickReplies(prev => [...prev, data.quickReply].sort((a, b) => a.shortcut.localeCompare(b.shortcut)))
        setNewQRShortcut('')
        setNewQRContent('')
        setPendingQRAudio(null)
        setNewQRTab('text')
      } else {
        setError(data.error || 'Erro ao salvar.')
      }
    } finally {
      setSavingQR(false)
    }
  }

  async function deleteQuickReply(id: string) {
    setDeletingQR(id)
    try {
      const res = await fetch(`/api/whatsapp/quick-replies?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setQuickReplies(prev => prev.filter(q => q.id !== id))
      }
    } finally {
      setDeletingQR(null)
    }
  }

  async function startQRRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      qrMediaRecorderRef.current = mr
      qrAudioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) qrAudioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(qrAudioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => { setPendingQRAudio(reader.result as string) }
        reader.readAsDataURL(blob)
        setRecordingQR(false)
        setRecordingQRSeconds(0)
      }
      mr.start()
      setRecordingQR(true)
      setRecordingQRSeconds(0)
      setPendingQRAudio(null)
      qrTimerRef.current = setInterval(() => setRecordingQRSeconds(s => s + 1), 1000)
    } catch {
      setError('Permissão de microfone necessária.')
    }
  }

  function stopQRRecording() {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    qrMediaRecorderRef.current?.stop()
  }

  function cancelQRRecording() {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    if (qrMediaRecorderRef.current && qrMediaRecorderRef.current.state !== 'inactive') {
      qrMediaRecorderRef.current.ondataavailable = null
      qrMediaRecorderRef.current.onstop = null
      qrMediaRecorderRef.current.stop()
    }
    setRecordingQR(false)
    setRecordingQRSeconds(0)
    setPendingQRAudio(null)
  }

  const searchTerm = text.startsWith('/') ? text.slice(1).toLowerCase() : ''
  const filteredQR = searchTerm
    ? quickReplies.filter(q =>
        q.shortcut.toLowerCase().includes(searchTerm) ||
        q.content.toLowerCase().includes(searchTerm)
      )
    : quickReplies

  const displayedMessages = searchQuery.trim()
    ? messages.filter(m => m.body?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const grouped = groupMessagesByDate(displayedMessages)
  const isGroup = contact.remote_jid?.endsWith('@g.us') || contact.phone?.includes('@g.us')

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Painel de perfil do participante ── */}
      {profilePanel && (
        <div className="absolute inset-0 bg-[#0b141a] z-30 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] flex-shrink-0">
            <button
              onClick={() => setProfilePanel(null)}
              className="text-[#8696a0] hover:text-white transition p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white font-medium text-sm">Dados do contato</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Foto e nome */}
            <div className="bg-[#111b21] flex flex-col items-center py-10 gap-4">
              {profilePanel.contact?.profile_pic_url ? (
                <img
                  src={profilePanel.contact.profile_pic_url}
                  alt={profilePanel.name}
                  className="w-32 h-32 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-semibold shadow-lg ${avatarColor(profilePanel.name)}`}>
                  {getInitials(profilePanel.name)}
                </div>
              )}
              <div className="text-center px-6">
                <p className="text-white text-xl font-light">{profilePanel.contact?.name || profilePanel.name}</p>
                <p className="text-[#8696a0] text-sm mt-1">+{profilePanel.phone}</p>
              </div>
            </div>

            {/* Botão Conversar */}
            {onOpenContact && (
              <div className="flex justify-center gap-8 py-6 border-b border-[#2a3942]">
                <button
                  onClick={() => {
                    onOpenContact(profilePanel.phone, contact.instance_name)
                    setProfilePanel(null)
                  }}
                  disabled={profilePanel.loading || !profilePanel.contact}
                  className="flex flex-col items-center gap-2 text-[#00a884] hover:text-[#06cf9c] disabled:opacity-40 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-[#202c33] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <span className="text-xs">Conversar</span>
                </button>
              </div>
            )}

            {/* Telefone */}
            <div className="px-6 py-5 border-b border-[#2a3942]">
              <p className="text-[#8696a0] text-xs mb-1">Telefone</p>
              <p className="text-[#e9edef] text-sm">+{profilePanel.phone}</p>
            </div>

            {/* Orçamento + Registrar venda */}
            {!profilePanel.loading && profilePanel.contact && (
              <div className="px-6 py-5 border-b border-[#2a3942] space-y-3">
                <p className="text-[#8696a0] text-xs font-medium uppercase tracking-wide">Orçamento / Venda</p>
                <div>
                  <label className="text-[#8696a0] text-xs mb-1 block">Valor (R$)</label>
                  <input
                    type="number"
                    min="0"
                    value={profileSaleValue}
                    onChange={e => setProfileSaleValue(e.target.value)}
                    className="w-full bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#2a3942] focus:border-[#00a884] transition"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (markingDirectSale) return
                    setMarkingDirectSale(true)
                    await fetch('/api/whatsapp/conversions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contact_id: profilePanel.contact!.id,
                        event_name: 'Purchase',
                        value: Number(profileSaleValue) || 0,
                        currency: 'BRL',
                      }),
                    })
                    setMarkingDirectSale(false)
                    setDirectSaleSuccess(true)
                    setTimeout(() => setDirectSaleSuccess(false), 2500)
                  }}
                  disabled={markingDirectSale}
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                    directSaleSuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-green-900/30 hover:bg-green-900/60 text-green-400 border border-green-800'
                  }`}
                >
                  {directSaleSuccess ? '✓ Venda registrada!' : markingDirectSale ? 'Registrando...' : '$ Registrar como venda (Meta Conversions)'}
                </button>
              </div>
            )}

            {profilePanel.loading && (
              <div className="flex justify-center py-6">
                <p className="text-[#8696a0] text-xs">Buscando informações...</p>
              </div>
            )}
            {!profilePanel.loading && !profilePanel.contact && (
              <div className="px-6 py-5">
                <p className="text-[#8696a0] text-xs italic">Contato não encontrado no CRM</p>
              </div>
            )}

            {/* ── Lead ── */}
            {!profilePanel.loading && profilePanel.contact && (
              <div className="px-6 py-5 border-t border-[#2a3942]">
                <p className="text-[#8696a0] text-xs mb-3 font-medium uppercase tracking-wide">Lead</p>
                {profilePanel.leadLoading ? (
                  <p className="text-[#8696a0] text-xs">Carregando lead...</p>
                ) : profilePanel.lead ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[#8696a0] text-xs mb-1 block">Nome do lead</label>
                      <input
                        value={profileLeadTitle}
                        onChange={e => setProfileLeadTitle(e.target.value)}
                        className="w-full bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#2a3942] focus:border-[#00a884] transition"
                      />
                    </div>
                    <div>
                      <label className="text-[#8696a0] text-xs mb-1 block">Valor (R$)</label>
                      <input
                        type="number"
                        min="0"
                        value={profileLeadValue}
                        onChange={e => setProfileLeadValue(e.target.value)}
                        className="w-full bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#2a3942] focus:border-[#00a884] transition"
                      />
                    </div>
                    <div>
                      <label className="text-[#8696a0] text-xs mb-1 block">Observações</label>
                      <textarea
                        rows={3}
                        value={profileLeadNotes}
                        onChange={e => setProfileLeadNotes(e.target.value)}
                        className="w-full bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#2a3942] focus:border-[#00a884] transition resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setSavingProfileLead(true)
                          await fetch('/api/whatsapp/leads', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: profilePanel.lead!.id, title: profileLeadTitle, value: Number(profileLeadValue) || 0, notes: profileLeadNotes }),
                          })
                          setSavingProfileLead(false)
                          setProfilePanel(prev => prev ? { ...prev, lead: { ...prev.lead!, title: profileLeadTitle, value: Number(profileLeadValue) || 0, notes: profileLeadNotes } } : null)
                        }}
                        disabled={savingProfileLead}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition"
                      >
                        {savingProfileLead ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Excluir este lead?')) return
                          await fetch(`/api/whatsapp/leads?id=${profilePanel.lead!.id}`, { method: 'DELETE' })
                          setProfilePanel(prev => prev ? { ...prev, lead: null } : null)
                        }}
                        className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-900 rounded-lg transition"
                      >
                        Excluir
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (markingWonProfile) return
                        setMarkingWonProfile(true)
                        await fetch('/api/whatsapp/conversions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            contact_id: profilePanel.lead!.contact_id,
                            lead_id: profilePanel.lead!.id,
                            event_name: 'Purchase',
                            value: Number(profileLeadValue) || 0,
                            currency: 'BRL',
                          }),
                        })
                        setMarkingWonProfile(false)
                        setWonSuccessProfile(true)
                        setTimeout(() => setWonSuccessProfile(false), 2000)
                      }}
                      disabled={markingWonProfile}
                      className={`w-full py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                        wonSuccessProfile
                          ? 'bg-green-600 text-white'
                          : 'bg-green-900/30 hover:bg-green-900/60 text-green-400 border border-green-800'
                      }`}
                    >
                      {wonSuccessProfile ? '✓ Venda registrada!' : markingWonProfile ? 'Registrando...' : '$ Registrar como venda (Meta Conversions)'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[#8696a0] text-xs italic">Nenhum lead vinculado a este contato</p>
                    <button
                      onClick={async () => {
                        const contactId = profilePanel.contact!.id
                        const res = await fetch('/api/whatsapp/leads', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ contact_id: contactId, title: profilePanel.contact!.name || profilePanel.phone }),
                        })
                        if (res.ok) {
                          const d = await res.json()
                          const newLead = d.lead ?? d
                          setProfilePanel(prev => prev ? { ...prev, lead: newLead } : null)
                          setProfileLeadTitle(newLead.title ?? '')
                          setProfileLeadValue(String(newLead.value ?? 0))
                          setProfileLeadNotes(newLead.notes ?? '')
                        }
                      }}
                      className="w-full py-2 text-sm font-medium rounded-lg border border-[#2a3942] text-[#00a884] hover:bg-[#202c33] transition"
                    >
                      + Criar lead para este contato
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sidebar de templates ── */}
      {templatesSidebar && (
        <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#111b21] border-l border-[#222e35] z-20 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#202c33] flex-shrink-0">
            <span className="text-white font-medium text-sm">Templates</span>
            <button onClick={() => setTemplatesSidebar(false)} className="text-[#8696a0] hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Busca */}
          <div className="px-3 py-2 flex-shrink-0 border-b border-[#222e35]">
            <div className="flex items-center bg-[#202c33] rounded-lg px-2 gap-2">
              <svg className="w-3.5 h-3.5 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Buscar template..."
                className="flex-1 bg-transparent text-white text-xs py-1.5 outline-none placeholder-[#8696a0]"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto py-1">
            {quickReplies
              .filter(q => !templateSearch || q.shortcut.includes(templateSearch) || q.content.toLowerCase().includes(templateSearch.toLowerCase()))
              .map(qr => (
                <div key={qr.id} className="px-3 py-2 border-b border-[#222e35]/60 hover:bg-[#202c33] transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono bg-[#2a3942] text-[#00a884] px-1.5 py-0.5 rounded flex-shrink-0">
                      {qr.shortcut}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { selectQuickReply(qr); setTemplatesSidebar(false) }}
                        className="text-[10px] bg-[#00a884] hover:bg-[#06cf9c] text-white px-2 py-0.5 rounded transition font-medium"
                      >
                        Enviar
                      </button>
                      <button
                        onClick={() => {
                          setTemplateVideoId(templateVideoId === qr.id ? null : qr.id)
                          setTemplateVideoUrl('')
                        }}
                        title="Enviar com vídeo"
                        className={`text-[10px] px-2 py-0.5 rounded transition font-medium ${templateVideoId === qr.id ? 'bg-indigo-600 text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'}`}
                      >
                        + Vídeo
                      </button>
                    </div>
                  </div>
                  <p className="text-[#8696a0] text-[11px] leading-relaxed line-clamp-2">{qr.content}</p>

                  {/* Mini-form de vídeo */}
                  {templateVideoId === qr.id && (
                    <div className="mt-2 flex gap-1.5">
                      <input
                        value={templateVideoUrl}
                        onChange={e => setTemplateVideoUrl(e.target.value)}
                        placeholder="URL do vídeo (mp4, drive...)"
                        className="flex-1 bg-[#202c33] text-[#e9edef] text-[10px] rounded px-2 py-1 outline-none border border-[#3d4f5a] focus:border-indigo-500 placeholder-[#8696a0]"
                      />
                      <button
                        disabled={!templateVideoUrl.trim() || sendingTemplateVideo}
                        onClick={async () => {
                          if (!templateVideoUrl.trim()) return
                          setSendingTemplateVideo(true)
                          // Envia a mensagem de texto primeiro
                          if (qr.content.trim()) {
                            await fetch('/api/whatsapp/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                instanceName: contact.instance_name,
                                phone: contact.phone,
                                message: qr.content,
                                contactId: contact.id,
                              }),
                            }).catch(() => {})
                          }
                          // Depois envia o vídeo
                          await fetch('/api/whatsapp/send-media', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              instanceName: contact.instance_name,
                              phone: contact.phone,
                              mediatype: 'video',
                              mimetype: 'video/mp4',
                              media: templateVideoUrl.trim(),
                              contactId: contact.id,
                            }),
                          }).catch(() => {})
                          setSendingTemplateVideo(false)
                          setTemplateVideoId(null)
                          setTemplateVideoUrl('')
                        }}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-2 py-1 rounded transition"
                      >
                        {sendingTemplateVideo ? '...' : 'OK'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            {quickReplies.length === 0 && (
              <p className="text-[#8696a0] text-xs text-center py-6 px-4 italic">
                Nenhum template criado ainda
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Gerenciador de respostas rápidas ── */}
      {showQRManager && (
        <div className="absolute inset-0 bg-[#0b141a] z-30 flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] flex-shrink-0">
            <button onClick={() => setShowQRManager(false)} className="text-[#8696a0] hover:text-white transition p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white font-medium text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Respostas Rápidas
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Lista de respostas salvas */}
            {qrLoading ? (
              <p className="text-[#8696a0] text-xs text-center py-6">Carregando...</p>
            ) : quickReplies.length === 0 ? (
              <p className="text-[#8696a0] text-xs text-center py-6 italic">Nenhuma resposta rápida criada ainda</p>
            ) : (
              <div className="divide-y divide-[#2a3942]">
                {quickReplies.map(qr => (
                  <div key={qr.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#111b21] transition group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#202c33] flex items-center justify-center">
                      {qr.type === 'audio' ? (
                        <svg className="w-4 h-4 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zm-1 13.93V19H9v2h6v-2h-2v-2.07A7.001 7.001 0 0019 12h-2a5 5 0 01-10 0H5a7.001 7.001 0 006 6.93z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] text-sm font-medium">/{qr.shortcut}</p>
                      {qr.type === 'audio' ? (
                        <AudioPlayer src={qr.content} fromMe={false} />
                      ) : (
                        <p className="text-[#8696a0] text-xs truncate mt-0.5">
                          {qr.content.length > 60 ? qr.content.slice(0, 60) + '…' : qr.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => sendQuickReply(qr)}
                        title="Enviar agora"
                        className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteQuickReply(qr.id)}
                        disabled={deletingQR === qr.id}
                        title="Excluir"
                        className="w-8 h-8 rounded-full hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário nova resposta */}
            <div className="px-4 py-4 border-t border-[#2a3942] mt-2">
              <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-3">Nova resposta rápida</p>

              {/* Atalho */}
              <div className="mb-3">
                <label className="text-[#8696a0] text-xs mb-1 block">Atalho (ex: oi, preco, obrigado)</label>
                <div className="flex items-center bg-[#2a3942] rounded-lg px-3 py-2 gap-1">
                  <span className="text-[#00a884] font-mono text-sm">/</span>
                  <input
                    type="text"
                    value={newQRShortcut}
                    onChange={e => setNewQRShortcut(e.target.value.replace(/\s/g, '').toLowerCase())}
                    placeholder="atalho"
                    className="flex-1 bg-transparent text-[#e9edef] text-sm outline-none placeholder-[#8696a0]"
                  />
                </div>
              </div>

              {/* Tabs tipo */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { setNewQRTab('text'); setPendingQRAudio(null); cancelQRRecording() }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${newQRTab === 'text' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'}`}
                >
                  Texto
                </button>
                <button
                  onClick={() => { setNewQRTab('audio'); setNewQRContent('') }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${newQRTab === 'audio' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'}`}
                >
                  Áudio
                </button>
              </div>

              {/* Conteúdo */}
              {newQRTab === 'text' ? (
                <textarea
                  value={newQRContent}
                  onChange={e => setNewQRContent(e.target.value)}
                  placeholder="Texto da mensagem..."
                  rows={3}
                  className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none placeholder-[#8696a0] resize-none mb-3"
                />
              ) : (
                <div className="mb-3">
                  {!recordingQR && !pendingQRAudio && (
                    <button
                      onClick={startQRRecording}
                      className="w-full py-3 bg-[#2a3942] hover:bg-[#3d4f5a] rounded-lg text-[#8696a0] hover:text-white transition flex items-center justify-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                      </svg>
                      Gravar áudio
                    </button>
                  )}
                  {recordingQR && (
                    <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg px-3 py-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
                      <span className="text-[#e9edef] text-sm flex-1">
                        {String(Math.floor(recordingQRSeconds / 60)).padStart(2,'0')}:{String(recordingQRSeconds % 60).padStart(2,'0')}
                      </span>
                      <button onClick={cancelQRRecording} className="text-[#8696a0] hover:text-red-400 transition text-xs">Cancelar</button>
                      <button onClick={stopQRRecording} className="px-3 py-1 bg-[#00a884] hover:bg-[#06cf9c] text-white text-xs rounded-lg transition">Parar</button>
                    </div>
                  )}
                  {pendingQRAudio && !recordingQR && (
                    <div className="bg-[#2a3942] rounded-lg p-3">
                      <AudioPlayer src={pendingQRAudio} fromMe={false} />
                      <button
                        onClick={() => { setPendingQRAudio(null) }}
                        className="mt-2 text-[#8696a0] hover:text-red-400 text-xs transition"
                      >
                        Regravar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={saveQuickReply}
                disabled={savingQR || !newQRShortcut.trim() || (newQRTab === 'text' ? !newQRContent.trim() : !pendingQRAudio)}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white rounded-lg text-sm font-medium transition"
              >
                {savingQR ? 'Salvando...' : 'Salvar resposta rápida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast de sucesso ── */}
      {forwardSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#005c4b] text-white text-sm px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 text-[#00a884]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {forwardSuccess}
        </div>
      )}

      {/* ── Modal: Encaminhar mensagem ── */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => { setForwardMsg(null); setForwardSearch('') }}>
          <div className="bg-[#202c33] rounded-2xl w-80 max-h-[70vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a3942]">
              <button onClick={() => { setForwardMsg(null); setForwardSearch('') }} className="text-[#8696a0] hover:text-white transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Encaminhar mensagem</p>
                <p className="text-[#8696a0] text-xs truncate">{forwardMsg.body || '[mídia]'}</p>
              </div>
            </div>
            <div className="px-3 py-2 border-b border-[#2a3942]">
              <input
                value={forwardSearch}
                onChange={e => { setForwardSearch(e.target.value); if (forwardContacts.length === 0) loadForwardContacts() }}
                onFocus={() => { if (forwardContacts.length === 0) loadForwardContacts() }}
                placeholder="Buscar contato..."
                className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none placeholder-[#8696a0]"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {forwardContacts
                .filter(c => !forwardSearch || c.name?.toLowerCase().includes(forwardSearch.toLowerCase()) || c.phone.includes(forwardSearch))
                .slice(0, 30)
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleForward(c)}
                    disabled={!!forwardingTo}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {(c.name || c.phone).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] text-sm truncate">{c.name || c.phone}</p>
                      <p className="text-[#8696a0] text-xs">{c.instance_name}</p>
                    </div>
                    {forwardingTo === c.id && <span className="text-[#00a884] text-xs">Enviando...</span>}
                  </button>
                ))}
              {forwardContacts.length === 0 && (
                <p className="text-[#8696a0] text-xs text-center py-6">Carregando contatos...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar exclusão ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[#202c33] rounded-2xl p-5 shadow-2xl w-72" onClick={e => e.stopPropagation()}>
            <p className="text-white font-medium mb-1">Apagar mensagem?</p>
            <p className="text-[#8696a0] text-sm mb-4 leading-relaxed">
              {deleteTarget.body ? `"${deleteTarget.body.slice(0, 60)}${deleteTarget.body.length > 60 ? '...' : ''}"` : '[mídia]'}
            </p>
            <div className="flex flex-col gap-2">
              {deleteTarget.from_me && (
                <button
                  onClick={() => handleDeleteForAll(deleteTarget)}
                  disabled={deletingMsg}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition"
                >
                  Apagar para todos
                </button>
              )}
              <button
                onClick={() => handleDeleteForMe(deleteTarget)}
                disabled={deletingMsg}
                className="w-full py-2.5 bg-[#2a3942] hover:bg-[#3d4a54] disabled:opacity-40 text-[#e9edef] text-sm font-medium rounded-xl transition"
              >
                Apagar para mim
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full py-2 text-[#8696a0] text-sm hover:text-white transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightboxSrc(null)}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Imagem"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#202c33] flex-shrink-0">
        <button
          onClick={onClose}
          className="md:hidden text-[#8696a0] hover:text-white transition p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition"
          onClick={() => openParticipantProfile(
            contact.name || contact.phone,
            contact.remote_jid || `${contact.phone}@s.whatsapp.net`
          )}
        >
          {(contact as any).profile_pic_url
            ? <img src={(contact as any).profile_pic_url} alt={contact.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" onError={e => { const el = e.target as HTMLImageElement; el.style.display='none'; (el.nextElementSibling as HTMLElement)?.style.removeProperty('display') }} />
            : null
          }
          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${avatarColor(contact.name)}`} style={(contact as any).profile_pic_url ? { display: 'none' } : {}}>
            {isGroup
              ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              : getInitials(contact.name)
            }
          </div>
          <div className="flex-1 min-w-0">
            {showSearch ? (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar nas mensagens..."
                className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded px-3 py-1 outline-none placeholder-[#8696a0]"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setShowSearch(false)
                    setSearchQuery('')
                  }
                }}
              />
            ) : (
              <>
                <p className="text-white font-medium text-sm truncate">{contact.name}</p>
                <p className="text-[#8696a0] text-xs truncate">
                  {isGroup ? 'Grupo' : contact.phone}
                </p>
              </>
            )}
          </div>
        </button>
        {/* Seletor de etapa do funil */}
        {funnels && funnels.length > 0 && (
          <div className="relative" ref={stageDropdownRef}>
            <button
              onClick={() => setShowStageDropdown(v => !v)}
              title="Mover para etapa do funil"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition max-w-[130px] ${
                showStageDropdown
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="truncate">
                {lead
                  ? (funnels.flatMap(f => f.crm_stages).find(s => s.id === lead.stage_id)?.name ?? 'Etapa')
                  : 'Etapa'}
              </span>
            </button>

            {showStageDropdown && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-[#2a3942]">
                  <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide">Mover para etapa</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {funnels.map(funnel => (
                    <div key={funnel.id}>
                      <p className="px-3 py-1.5 text-[#8696a0] text-[10px] font-semibold uppercase tracking-wider bg-[#0b141a]">
                        {funnel.name}
                      </p>
                      {funnel.crm_stages.map(stage => (
                        <button
                          key={stage.id}
                          onClick={() => updateStage(stage.id)}
                          disabled={updatingStage}
                          className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                            lead?.stage_id === stage.id
                              ? 'text-[#00a884] bg-[#0b141a]'
                              : 'text-[#e9edef] hover:bg-[#2a3942]'
                          }`}
                        >
                          {lead?.stage_id === stage.id && (
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className={lead?.stage_id === stage.id ? '' : 'ml-5'}>{stage.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão mensagem interativa */}
        {!isGroup && (
          <button
            onClick={() => setShowInteractive(v => !v)}
            title="Enviar mensagem interativa (botões ou lista)"
            className={`p-1.5 rounded-full transition ${showInteractive ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
            </svg>
          </button>
        )}

        {/* Botão transferir */}
        <button
          onClick={() => { setShowTransfer(v => !v); loadAgents() }}
          title={currentAgent ? `Atribuído a: ${currentAgent.name}` : 'Transferir conversa'}
          className={`p-1.5 rounded-full transition ${showTransfer ? 'text-[#00a884]' : currentAgent ? 'text-indigo-400' : 'text-[#8696a0] hover:text-white'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Botão sidebar de templates */}
        <button
          onClick={() => { setTemplatesSidebar(v => !v); if (quickReplies.length === 0) loadQuickReplies() }}
          title="Templates"
          className={`p-1.5 rounded-full transition ${templatesSidebar ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>

        {/* Botão de busca */}
        <button
          onClick={() => {
            setShowSearch(v => !v)
            if (showSearch) setSearchQuery('')
          }}
          className={`p-1.5 rounded-full transition ${showSearch ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
          title="Buscar mensagens"
        >
          {showSearch ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Busca ativa: badge com contagem */}
      {showSearch && searchQuery && (
        <div className="bg-[#2a3942] px-4 py-1.5 flex-shrink-0">
          <p className="text-[#8696a0] text-xs">
            {displayedMessages.length === 0
              ? 'Nenhuma mensagem encontrada'
              : `${displayedMessages.length} mensagem(ns) encontrada(s)`}
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={() => {
          const el = scrollContainerRef.current
          if (!el) return
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
          isAtBottomRef.current = atBottom
          setShowScrollBtn(!atBottom)
        }}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#0b141a',
        }}
      >
        {loading && (
          <p className="text-[#8696a0] text-sm text-center py-4">Carregando mensagens...</p>
        )}
        {!loading && hasMore && (
          <div className="flex justify-center my-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-[#182229] text-[#8696a0] hover:text-white text-xs px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {loadingMore ? (
                <><span className="inline-block w-3 h-3 border border-[#8696a0] border-t-transparent rounded-full animate-spin"/>Carregando...</>
              ) : '↑ Carregar mensagens anteriores'}
            </button>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
              Nenhuma mensagem ainda
            </span>
          </div>
        )}
        {!loading && messages.length > 0 && displayedMessages.length === 0 && searchQuery && (
          <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
              Nenhuma mensagem corresponde à busca
            </span>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-1.5 rounded-lg">
                {group.date}
              </span>
            </div>
            {group.messages.map((msg, idx) => {
              const senderName = isGroup
                ? (msg.participant_name || '')
                : (!msg.from_me ? (contact.name || contact.phone) : '')
              const showSender = !msg.from_me && senderName && (
                isGroup
                  ? (idx === 0 || group.messages[idx - 1].participant_jid !== msg.participant_jid || group.messages[idx - 1].from_me)
                  : (idx === 0 || group.messages[idx - 1].from_me)
              )
              const color = senderName ? senderColor(senderName) : '#8696a0'
              const isIntMsg = msg.is_internal

              const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🙏']
              const replyData = (msg.media_data as Record<string, unknown> | null)?._reply as { body?: string; sender_name?: string | null; from_me?: boolean } | undefined
              const isMenuOpen = menuMsgId === msg.id
              const isReactOpen = reactionMsgId === msg.id

              return (
                <div key={msg.id} className={`relative flex mb-1 group/msg ${msg.from_me ? 'justify-end' : 'justify-start'}`}>

                  {/* Botões de ação — ficam visíveis no hover OU quando menu/reação estão abertos */}
                  <div
                    className={`flex items-center gap-0.5 transition-opacity duration-150 flex-shrink-0 self-end mb-1 ${msg.from_me ? 'order-first mr-1' : 'order-last ml-1'} ${isMenuOpen || isReactOpen ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}
                  >
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => { setReactionMsgId(id => id === msg.id ? null : msg.id); setMenuMsgId(null) }}
                      className="w-7 h-7 rounded-full bg-[#233138] hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-white transition shadow"
                      title="Reagir"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => { setMenuMsgId(id => id === msg.id ? null : msg.id); setReactionMsgId(null) }}
                      className="w-7 h-7 rounded-full bg-[#233138] hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-white transition shadow"
                      title="Mais opções"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z"/>
                      </svg>
                    </button>
                  </div>

                  {/* Picker de reações — fora do container de opacidade, não some ao mover o mouse */}
                  {isReactOpen && (
                    <div
                      ref={menuRef}
                      className={`absolute bottom-10 z-30 flex items-center gap-1 bg-[#233138] border border-[#2a3942] rounded-full px-3 py-2 shadow-2xl ${msg.from_me ? 'right-16' : 'left-16'}`}
                    >
                      {QUICK_EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReact(msg, e)} className="text-xl hover:scale-125 transition-transform leading-none">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Menu dropdown — fora do container de opacidade */}
                  {isMenuOpen && (
                    <div
                      ref={menuRef}
                      className={`absolute bottom-10 z-30 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1 min-w-[165px] ${msg.from_me ? 'right-16' : 'left-16'}`}
                    >
                      <button
                        onClick={() => { setReplyingTo(msg); setMenuMsgId(null); setTimeout(() => inputRef.current?.focus(), 50) }}
                        className="w-full text-left px-4 py-2.5 text-[#e9edef] text-sm hover:bg-[#2a3942] transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Responder
                      </button>
                      <button
                        onClick={() => { setForwardMsg(msg); setMenuMsgId(null); loadForwardContacts() }}
                        className="w-full text-left px-4 py-2.5 text-[#e9edef] text-sm hover:bg-[#2a3942] transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3-3 3m-9 0v-3a6 6 0 016-6h9"/></svg>
                        Encaminhar
                      </button>
                      <div className="h-px bg-[#2a3942] mx-2 my-1"/>
                      <button
                        onClick={() => { setDeleteTarget(msg); setMenuMsgId(null) }}
                        className="w-full text-left px-4 py-2.5 text-red-400 text-sm hover:bg-[#2a3942] transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Apagar
                      </button>
                    </div>
                  )}

                  <div
                    className={`max-w-[65%] px-3 py-2 rounded-lg shadow-sm relative ${
                      isIntMsg
                        ? 'border border-yellow-600 rounded-br-none'
                        : msg.from_me
                          ? 'bg-[#005c4b] text-white rounded-br-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-bl-none'
                    }`}
                    style={isIntMsg ? { backgroundColor: '#2d3748', color: '#e9edef' } : undefined}
                  >
                    {/* Mensagem apagada para todos */}
                    {msg.message_type === 'revoked' ? (
                      <p className="text-sm italic text-[#8696a0] flex items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        Mensagem apagada
                        <span className={`ml-1 text-[10px] not-italic ${msg.from_me ? 'text-[#8aaabf]' : 'text-[#8696a0]'}`}>{formatTime(msg.timestamp)}</span>
                      </p>
                    ) : (<>

                    {/* Badge nota interna */}
                    {isIntMsg && (
                      <span className="inline-block text-yellow-400 text-[10px] font-semibold uppercase tracking-wide mb-1 border border-yellow-700 rounded px-1">
                        Interno
                      </span>
                    )}

                    {/* Quoted message (reply) */}
                    {replyData && (
                      <div className={`flex gap-1.5 mb-2 rounded-lg overflow-hidden cursor-default ${msg.from_me ? 'bg-[#004034]' : 'bg-[#1a2530]'}`}>
                        <div className="w-1 bg-[#00a884] flex-shrink-0 rounded-l-lg" />
                        <div className="flex-1 px-2 py-1.5 min-w-0">
                          <p className="text-[#00a884] text-[11px] font-medium mb-0.5">
                            {replyData.from_me ? 'Você' : (replyData.sender_name || contact.name || contact.phone)}
                          </p>
                          <p className="text-[#8696a0] text-xs truncate">{replyData.body || '[mídia]'}</p>
                        </div>
                      </div>
                    )}

                    {showSender && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isGroup) {
                            openParticipantProfile(senderName, msg.participant_jid || '')
                          } else {
                            openParticipantProfile(
                              contact.name || contact.phone,
                              contact.remote_jid || `${contact.phone}@s.whatsapp.net`
                            )
                          }
                        }}
                        className="text-xs font-semibold mb-1 hover:underline text-left block"
                        style={{ color }}
                      >
                        {senderName}
                      </button>
                    )}
                    {/* Imagem */}
                    {(msg.message_type === 'imageMessage' || msg.message_type === 'stickerMessage') && (
                      msg.media_url
                        ? <img
                            src={msg.media_url}
                            alt="Imagem"
                            className="rounded-lg max-w-[260px] max-h-[260px] object-cover cursor-pointer mb-1"
                            onClick={() => setLightboxSrc(msg.media_url!)}
                          />
                        : <span className="italic text-[#8696a0] text-xs">📷 Imagem</span>
                    )}

                    {/* Áudio */}
                    {(msg.message_type === 'audioMessage' || msg.message_type === 'ptvMessage') && (
                      msg.media_url
                        ? <AudioPlayer src={msg.media_url} fromMe={msg.from_me} />
                        : <span className="italic text-[#8696a0] text-xs">🎵 Áudio</span>
                    )}

                    {/* Vídeo */}
                    {msg.message_type === 'videoMessage' && (
                      msg.media_url?.startsWith('data:video/') ? (
                        <video controls className="rounded-lg max-w-[260px] max-h-[220px] mb-1" style={{ background: '#000' }}>
                          <source src={msg.media_url} />
                        </video>
                      ) : msg.media_url?.startsWith('data:image/') && msg.message_id ? (
                        <VideoPlayer
                          thumbnail={msg.media_url}
                          messageId={msg.message_id}
                          instance={contact.instance_name}
                        />
                      ) : (
                        <span className="italic text-[#8696a0] text-xs">🎥 Vídeo</span>
                      )
                    )}

                    {/* Documento */}
                    {msg.message_type === 'documentMessage' && (
                      <span className="italic text-[#8696a0] text-xs">📄 Documento</span>
                    )}

                    {/* Contato compartilhado */}
                    {(msg.message_type === 'contactMessage' || msg.message_type === 'contactsArrayMessage') && (() => {
                      const d = msg.media_data as Record<string, unknown> | null
                      if (!d) return <span className="italic text-[#8696a0] text-xs">👤 Contato</span>
                      if (msg.message_type === 'contactMessage') {
                        return (
                          <ContactCard
                            displayName={(d.displayName as string) || ''}
                            vcard={(d.vcard as string) || ''}
                            fromMe={msg.from_me}
                            instanceName={contact.instance_name}
                            onConverse={onOpenContact}
                          />
                        )
                      }
                      const contacts = (d.contacts as Array<{ displayName: string; vcard: string }>) ?? []
                      return (
                        <div className="flex flex-col gap-2">
                          {contacts.map((c, i) => (
                            <ContactCard
                              key={i}
                              displayName={c.displayName}
                              vcard={c.vcard}
                              fromMe={msg.from_me}
                              instanceName={contact.instance_name}
                              onConverse={onOpenContact}
                            />
                          ))}
                        </div>
                      )
                    })()}

                    {/* Enquete */}
                    {msg.message_type === 'pollCreationMessage' && (() => {
                      type PollOption = { name: string; votes: number }
                      const d = msg.media_data as { name: string; options: PollOption[]; selectableCount: number } | null
                      if (!d?.options) return <span className="italic text-[#8696a0] text-xs flex items-center gap-1">📊 Enquete</span>
                      const totalVotes = d.options.reduce((s, o) => s + (o.votes || 0), 0)
                      return (
                        <div style={{ minWidth: 200, maxWidth: 280 }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: msg.from_me ? '#e9edef' : '#00a884' }} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C3.6 3 3 3.6 3 4.5v15C3 20.4 3.6 21 4.5 21h15c.9 0 1.5-.6 1.5-1.5v-15C21 3.6 20.4 3 19.5 3z"/>
                            </svg>
                            <span className="text-[11px] font-medium opacity-70">ENQUETE</span>
                          </div>
                          <p className="text-sm font-medium leading-snug mb-3">{d.name || msg.body}</p>
                          <div className="space-y-2">
                            {d.options.map((opt, i) => {
                              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                              return (
                                <div key={i}>
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-[#e9edef] leading-tight">{opt.name}</span>
                                    {totalVotes > 0 && <span className="text-[#8696a0] ml-2 flex-shrink-0">{pct}%</span>}
                                  </div>
                                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: msg.from_me ? '#e9edef' : '#00a884' }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {totalVotes > 0 && (
                            <p className="text-[10px] mt-2 opacity-50">{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</p>
                          )}
                          {totalVotes === 0 && (
                            <p className="text-[10px] mt-2 opacity-40">Selecione uma ou mais opções</p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Texto (incluindo legenda de imagem/vídeo) */}
                    {msg.message_type !== 'imageMessage' &&
                     msg.message_type !== 'stickerMessage' &&
                     msg.message_type !== 'audioMessage' &&
                     msg.message_type !== 'ptvMessage' &&
                     msg.message_type !== 'videoMessage' &&
                     msg.message_type !== 'documentMessage' &&
                     msg.message_type !== 'contactMessage' &&
                     msg.message_type !== 'contactsArrayMessage' &&
                     msg.message_type !== 'pollCreationMessage' && (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.body
                          ? renderMessageText(msg.body, searchQuery)
                          : <span className="italic text-[#8696a0] text-xs">[mídia]</span>}
                      </p>
                    )}

                    {/* Legenda de imagem/vídeo */}
                    {(msg.message_type === 'imageMessage' || msg.message_type === 'videoMessage') && msg.body && (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mt-1">{renderMessageText(msg.body, searchQuery)}</p>
                    )}

                    {/* Reações */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {Object.entries(msg.reactions as Record<string, string>)
                          .filter(([, emoji]) => emoji)
                          .reduce((acc, [, emoji]) => {
                            const ex = acc.find(e => e.emoji === emoji)
                            if (ex) ex.count++
                            else acc.push({ emoji, count: 1 })
                            return acc
                          }, [] as { emoji: string; count: number }[])
                          .map(({ emoji, count }) => (
                            <span key={emoji} className="text-xs bg-[#2a3942] rounded-full px-1.5 py-0.5 flex items-center gap-0.5 border border-[#3b4a54]">
                              {emoji}{count > 1 && <span className="text-[#8696a0] text-[10px] ml-0.5">{count}</span>}
                            </span>
                          ))
                        }
                      </div>
                    )}

                    <p className={`text-[10px] mt-1 text-right flex items-center justify-end gap-0.5 ${msg.from_me ? 'text-[#8aaabf]' : 'text-[#8696a0]'}`}>
                      {formatTime(msg.timestamp)}
                      {msg.from_me && !isIntMsg && <MsgStatus status={msg.status} />}
                    </p>
                    </>)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Botão scroll para o final (estilo WhatsApp) */}
      {showScrollBtn && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="absolute bottom-24 right-5 z-10 w-10 h-10 rounded-full bg-[#202c33] border border-[#2a3942] shadow-lg flex items-center justify-center hover:bg-[#2a3942] transition-colors"
          title="Ir para o final"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
          <p className="text-red-400 text-xs">Erro: {error}</p>
        </div>
      )}

      {/* Painel de agendamento */}
      {showSchedule && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-2 flex-shrink-0">
          <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-2">Agendar mensagem</p>
          <div className="flex gap-2 mb-3">
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={e => setScheduleAt(e.target.value)}
              className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] transition"
            />
            <button
              onClick={scheduleMessage}
              disabled={!text.trim() || !scheduleAt || scheduling}
              className="bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white text-xs px-3 py-2 rounded-lg transition font-medium"
            >
              {scheduling ? 'Agendando...' : 'Agendar'}
            </button>
          </div>

          {/* Lista de agendadas */}
          {loadingScheduled ? (
            <p className="text-[#8696a0] text-xs mb-2">Carregando agendamentos...</p>
          ) : scheduledMessages.length > 0 ? (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              <p className="text-[#8696a0] text-xs font-medium mb-1">Pendentes:</p>
              {scheduledMessages.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-[#2a3942] rounded px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#e9edef] text-xs truncate">{s.body}</p>
                    <p className="text-[#8696a0] text-[10px]">
                      {new Date(s.send_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelScheduled(s.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 border border-red-900 rounded transition flex-shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#8696a0] text-xs">Nenhum agendamento pendente.</p>
          )}
        </div>
      )}

      {/* Painel de transferência */}
      {showTransfer && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-3 flex-shrink-0">
          <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-2">Transferir conversa</p>
          {currentAgent && (
            <p className="text-indigo-400 text-xs mb-2">Atribuído atual: <strong>{currentAgent.name}</strong></p>
          )}
          <div className="space-y-2">
            <select
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] transition"
            >
              <option value="">Selecionar agente...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
              ))}
            </select>
            <input
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              placeholder="Nota de transferência (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition"
            />
            <div className="flex gap-2">
              <button
                onClick={transfer}
                disabled={!transferTo || transferring}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium py-2 rounded-lg transition"
              >
                {transferring ? 'Transferindo...' : 'Transferir'}
              </button>
              <button
                onClick={() => setShowTransfer(false)}
                className="px-3 py-2 text-xs text-[#8696a0] hover:text-white border border-[#3b4a54] rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de mensagem interativa */}
      {showInteractive && (
        <div className="bg-[#202c33] border-t border-[#2a3942] px-4 pt-3 pb-3 flex-shrink-0 max-h-80 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setInteractiveTab('buttons')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${interactiveTab === 'buttons' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0]'}`}
            >Botões</button>
            <button
              onClick={() => setInteractiveTab('list')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${interactiveTab === 'list' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0]'}`}
            >Lista</button>
          </div>
          <div className="space-y-2">
            <input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder="Título (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
            <textarea value={iBody} onChange={e => setIBody(e.target.value)} placeholder="Corpo da mensagem *" rows={2}
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition resize-none" />
            <input value={iFooter} onChange={e => setIFooter(e.target.value)} placeholder="Rodapé (opcional)"
              className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
            {interactiveTab === 'buttons' ? (
              <div className="space-y-1.5">
                <p className="text-[#8696a0] text-[10px] uppercase tracking-wide">Botões (máx. 3)</p>
                {iButtons.map((btn, i) => (
                  <div key={btn.id} className="flex gap-1.5">
                    <input value={btn.text} onChange={e => setIButtons(prev => prev.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
                      placeholder={`Botão ${i + 1}`}
                      className="flex-1 bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
                    {iButtons.length > 1 && (
                      <button onClick={() => setIButtons(prev => prev.filter((_, j) => j !== i))} className="text-[#8696a0] hover:text-red-400 transition px-1">×</button>
                    )}
                  </div>
                ))}
                {iButtons.length < 3 && (
                  <button onClick={() => setIButtons(prev => [...prev, { id: String(Date.now()), text: '' }])}
                    className="text-[#8696a0] hover:text-white text-xs transition">+ Adicionar botão</button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <input value={iListBtn} onChange={e => setIListBtn(e.target.value)} placeholder="Texto do botão principal *"
                  className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1.5 outline-none border border-[#3b4a54] focus:border-[#00a884] placeholder-[#8696a0] transition" />
                {iSections.map((sec, si) => (
                  <div key={si} className="bg-[#0b141a] rounded-lg p-2 space-y-1.5">
                    <input value={sec.title} onChange={e => setISections(prev => prev.map((s, j) => j === si ? { ...s, title: e.target.value } : s))}
                      placeholder="Título da seção" className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1 outline-none border border-[#3b4a54] placeholder-[#8696a0] transition" />
                    {sec.rows.map((row, ri) => (
                      <input key={row.id} value={row.title}
                        onChange={e => setISections(prev => prev.map((s, j) => j === si ? { ...s, rows: s.rows.map((r, k) => k === ri ? { ...r, title: e.target.value } : r) } : s))}
                        placeholder={`Item ${ri + 1}`} className="w-full bg-[#2a3942] text-[#e9edef] text-xs rounded px-2 py-1 outline-none border border-[#3b4a54] placeholder-[#8696a0] transition" />
                    ))}
                    <button onClick={() => setISections(prev => prev.map((s, j) => j === si ? { ...s, rows: [...s.rows, { id: String(Date.now()), title: '' }] } : s))}
                      className="text-[#8696a0] hover:text-white text-xs transition">+ Item</button>
                  </div>
                ))}
                <button onClick={() => setISections(prev => [...prev, { title: '', rows: [{ id: String(Date.now()), title: '' }] }])}
                  className="text-[#8696a0] hover:text-white text-xs transition">+ Seção</button>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={sendInteractive} disabled={!iBody.trim() || sendingInteractive}
                className="flex-1 bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white text-xs font-medium py-2 rounded-lg transition">
                {sendingInteractive ? 'Enviando...' : 'Enviar'}
              </button>
              <button onClick={() => setShowInteractive(false)}
                className="px-3 py-2 text-xs text-[#8696a0] hover:text-white border border-[#3b4a54] rounded-lg transition">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 relative">
        {/* Emoji picker */}
        {showEmoji && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-4 mb-1 w-72 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl z-50 p-3"
          >
            <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
              {[
                '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘',
                '😋','😛','😜','🤪','😎','🤩','🥳','😏','😒','😔','😢','😭','😤','😠','😡','🤬',
                '🤯','😳','😱','😨','🥺','😓','🤗','🤔','😶','😐','🙄','😮','🥱','😴','🤐','🤧',
                '👍','👎','👏','🙌','🤝','✊','🤞','✌️','🤙','💪','🙏','👋','🫶','👌','🤟','🤘',
                '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💞','💓','💗','💖','💘','💝',
                '🔥','✅','🎉','🚀','👀','💯','⚡','🌟','💥','🎯','💡','🔑','💎','🏆','🎁','🎊',
                '😂','🥲','🫠','🤭','🫡','🤫','🫢','🥹','🫣','🤌','🫰','🫵','🫱','🫲','🤏','👆',
              ].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { setText(t => t + emoji); setShowEmoji(false) }}
                  className="text-xl hover:bg-[#2a3942] rounded p-0.5 transition leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dropdown quick replies */}
        {showQuickReplies && (
          <div
            ref={quickRepliesRef}
            className="absolute bottom-full left-4 right-4 mb-1 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[#2a3942] flex items-center justify-between">
              <p className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide">Respostas rápidas</p>
              <button
                onClick={() => setShowQuickReplies(false)}
                className="text-[#8696a0] hover:text-white transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {qrLoading ? (
                <p className="text-[#8696a0] text-xs text-center py-3">Carregando...</p>
              ) : filteredQR.length === 0 ? (
                <p className="text-[#8696a0] text-xs text-center py-3">Nenhuma resposta encontrada</p>
              ) : (
                filteredQR.map((qr, i) => (
                  <div
                    key={qr.id}
                    className={`flex items-center gap-2 hover:bg-[#2a3942] transition ${i === qrSelected ? 'bg-[#2a3942]' : ''}`}
                  >
                    <button
                      onClick={() => qr.type === 'audio' ? sendQuickReply(qr) : selectQuickReply(qr)}
                      className="flex-1 text-left px-4 py-2.5 flex items-center gap-3 min-w-0"
                    >
                      <span className="text-[#00a884] font-mono text-xs bg-[#0b141a] px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                        {qr.type === 'audio' && (
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zm-1 13.93V19H9v2h6v-2h-2v-2.07A7.001 7.001 0 0019 12h-2a5 5 0 01-10 0H5a7.001 7.001 0 006 6.93z"/>
                          </svg>
                        )}
                        /{qr.shortcut}
                      </span>
                      <span className="text-[#e9edef] text-sm truncate leading-relaxed">
                        {qr.type === 'audio' ? '🎤 Mensagem de áudio' : (qr.content.length > 60 ? qr.content.slice(0, 60) + '…' : qr.content)}
                      </span>
                    </button>
                    <button
                      onClick={() => sendQuickReply(qr)}
                      title="Enviar agora"
                      className="mr-3 w-7 h-7 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white flex items-center justify-center transition flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Preview de resposta ativa */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1f2c34] border-t border-[#2a3942] flex-shrink-0">
            <div className="w-0.5 self-stretch bg-[#00a884] rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[#00a884] text-xs font-medium">{replyingTo.from_me ? 'Você' : (contact.name || contact.phone)}</p>
              <p className="text-[#8696a0] text-xs truncate">{replyingTo.body || '[mídia]'}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-white transition flex-shrink-0 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Gravando áudio */}
        {recording ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33]">
            <button onClick={cancelRecording} className="w-9 h-9 rounded-full bg-[#2a3942] text-[#8696a0] hover:text-red-400 flex items-center justify-center transition flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
              <span className="text-[#e9edef] text-sm">
                {String(Math.floor(recordingSeconds / 60)).padStart(2,'0')}:{String(recordingSeconds % 60).padStart(2,'0')}
              </span>
              <span className="text-[#8696a0] text-xs">Gravando...</span>
            </div>
            <button
              onClick={stopRecording}
              disabled={sendingAudio}
              className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white flex items-center justify-center transition flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className={`flex items-end gap-2 px-4 py-3 bg-[#202c33] ${isInternal ? 'border-t-2 border-yellow-600' : ''}`}>
            {/* Botão nota interna */}
            <button
              onClick={() => setIsInternal(v => !v)}
              title={isInternal ? 'Modo nota interna (clique para desativar)' : 'Escrever nota interna'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                isInternal ? 'bg-yellow-600 text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {/* Botão agendar */}
            <button
              onClick={() => setShowSchedule(v => !v)}
              title="Agendar mensagem"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                showSchedule ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Textarea + emoji */}
            <div className={`flex-1 rounded-lg px-3 py-2 ${isInternal ? 'bg-[#2d3748] border border-yellow-700' : 'bg-[#2a3942]'}`}>
              {isInternal && (
                <p className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wide mb-1">Nota interna</p>
              )}
              <div className="flex items-end gap-1">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isInternal ? 'Escrever nota interna...' : 'Digite uma mensagem ou / para respostas rápidas'}
                  rows={1}
                  className="flex-1 bg-transparent text-[#e9edef] text-sm outline-none placeholder-[#8696a0] resize-none max-h-32 leading-relaxed"
                  style={{ height: 'auto' }}
                  onInput={e => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                  }}
                />
                <button
                  onClick={() => setShowEmoji(v => !v)}
                  title="Emojis"
                  className={`p-1 rounded transition flex-shrink-0 ${showEmoji ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </button>
                <button
                  onClick={() => { setShowQRManager(true); if (quickReplies.length === 0) loadQuickReplies() }}
                  title="Respostas rápidas"
                  className={`p-1 rounded transition flex-shrink-0 ${showQRManager ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Botão enviar ou microfone */}
            {text.trim() ? (
              <button
                onClick={send}
                disabled={sending}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white flex items-center justify-center transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={sendingAudio || isInternal}
                title="Gravar áudio"
                className="w-10 h-10 rounded-full bg-[#2a3942] hover:bg-[#3d4f5a] disabled:opacity-40 text-[#8696a0] hover:text-white flex items-center justify-center transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
