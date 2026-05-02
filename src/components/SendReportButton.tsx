'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  from: string
  to: string
  adAccountId: string
  accountName: string
  linkedGroupJid?: string | null
}

interface Group {
  id: string
  subject: string
}

export function SendReportButton({ from, to, adAccountId, accountName, linkedGroupJid }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [linkedJid, setLinkedJid] = useState(linkedGroupJid ?? null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [search, setSearch] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setShowModal(false)
    }
    if (showModal) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showModal])

  async function openModal() {
    setShowModal(true)
    setGroupError('')
    setSearch('')
    if (groups.length > 0) return
    setLoadingGroups(true)
    const res = await fetch('/api/whatsapp/groups')
    const data = await res.json()
    if (!res.ok || data.error) {
      setGroupError(data.error || 'Erro ao carregar grupos')
    } else {
      setGroups([...(data.groups || [])].sort((a, b) =>
        a.subject.localeCompare(b.subject, 'pt-BR', { numeric: true, sensitivity: 'base' })
      ))
    }
    setLoadingGroups(false)
  }

  async function linkGroup(group: Group, instanceName: string) {
    await fetch('/api/accounts/link-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adAccountId, groupJid: group.id, instanceName }),
    })
    setLinkedJid(group.id)
    setSelectedGroup(group)
    setShowModal(false)
  }

  async function unlinkGroup() {
    await fetch('/api/accounts/link-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adAccountId, groupJid: null, instanceName: null }),
    })
    setLinkedJid(null)
    setSelectedGroup(null)
  }

  async function sendReport() {
    setSending(true)
    setMsg(null)
    try {
      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')

      const res = await fetch(`/api/report-data?from=${from}&to=${to}&account=${adAccountId}`)
      const data = await res.json()

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()

      // Header
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, W, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text(`Relatório de Anúncios — ${accountName}`, 14, 10)
      doc.setFontSize(9)
      doc.setTextColor(148, 163, 184)
      doc.text(`Período: ${from} → ${to}`, 14, 17)

      let y = 30

      // Meta
      const m = data.meta
      if (m) {
        doc.setFontSize(11); doc.setTextColor(99, 102, 241)
        doc.text('Meta Ads', 14, y); y += 6

        ;(doc as any).autoTable({
          startY: y,
          head: [['Investido', 'Impressões', 'Cliques', 'CTR', 'CPM', 'Conversões', 'Custo/Conv.']],
          body: [[
            `R$ ${(m.totals?.spend || 0).toFixed(2)}`,
            (m.totals?.impressions || 0).toLocaleString('pt-BR'),
            (m.totals?.clicks || 0).toLocaleString('pt-BR'),
            `${((m.totals?.ctr || 0) * 100).toFixed(2)}%`,
            `R$ ${(m.totals?.cpm || 0).toFixed(2)}`,
            (m.totals?.conversions || 0).toLocaleString('pt-BR'),
            `R$ ${(m.totals?.costPerConversion || 0).toFixed(2)}`,
          ]],
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [99, 102, 241] },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8

        if (m.campaigns?.length > 0) {
          ;(doc as any).autoTable({
            startY: y,
            head: [['Campanha', 'Investido', 'Impressões', 'Cliques', 'Conversões']],
            body: m.campaigns.map((c: any) => [
              c.campaign_name, `R$ ${c.spend?.toFixed(2)}`,
              c.impressions?.toLocaleString('pt-BR'), c.clicks?.toLocaleString('pt-BR'),
              c.conversions?.toLocaleString('pt-BR'),
            ]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [30, 41, 59] },
            margin: { left: 14, right: 14 },
          })
          y = (doc as any).lastAutoTable.finalY + 8
        }
      }

      const pdfBase64 = doc.output('datauristring').split(',')[1]
      const filename = `relatorio-${accountName.replace(/\s/g, '-')}-${from}-${to}.pdf`

      const sendRes = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId, pdfBase64, filename }),
      })
      const sendData = await sendRes.json()

      if (!sendRes.ok) {
        setMsg({ text: sendData.error || 'Erro ao enviar', ok: false })
      } else {
        setMsg({ text: 'Relatório enviado no grupo!', ok: true })
        setTimeout(() => setMsg(null), 4000)
      }
    } catch (e: any) {
      setMsg({ text: 'Erro ao gerar PDF', ok: false })
    } finally {
      setSending(false)
    }
  }

  const filteredGroups = groups.filter(g =>
    g.subject.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative flex items-center gap-2">
      {msg && (
        <span className={`text-xs px-2 py-1 rounded ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {msg.text}
        </span>
      )}

      {linkedJid ? (
        <div className="flex items-center gap-1">
          <button
            onClick={sendReport}
            disabled={sending}
            title="Enviar relatório para o grupo vinculado"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {sending ? 'Enviando...' : 'Enviar relatório'}
          </button>
          <button
            onClick={openModal}
            title="Trocar grupo"
            className="px-2 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg transition"
          >
            ⚙
          </button>
        </div>
      ) : (
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          Vincular grupo
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div ref={modalRef} className="bg-[#1e293b] border border-slate-700 rounded-2xl p-5 w-96 max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Vincular grupo WhatsApp</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            {linkedJid && (
              <div className="mb-3 flex items-center justify-between bg-emerald-900/30 border border-emerald-700 rounded-xl px-3 py-2">
                <span className="text-emerald-300 text-xs">Grupo vinculado ativo</span>
                <button onClick={unlinkGroup} className="text-xs text-red-400 hover:text-red-300">Desvincular</button>
              </div>
            )}

            {loadingGroups ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : groupError ? (
              <p className="text-red-400 text-sm text-center py-4">{groupError}</p>
            ) : (
              <>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar grupo..."
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="overflow-y-auto flex-1 space-y-1">
                  {filteredGroups.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">Nenhum grupo encontrado</p>
                  )}
                  {filteredGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={async () => {
                        const res = await fetch('/api/whatsapp/groups')
                        const d = await res.json()
                        linkGroup(g, d.instanceName)
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition ${
                        linkedJid === g.id
                          ? 'bg-indigo-700 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="mr-2">👥</span>{g.subject}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
