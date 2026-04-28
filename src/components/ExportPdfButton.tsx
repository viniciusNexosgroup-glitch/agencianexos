'use client'

import { useState } from 'react'

interface Props {
  from: string
  to: string
}

const MATCH_LABEL: Record<string, string> = {
  EXACT: 'Exata', BROAD: 'Ampla', PHRASE: 'Frase',
  '2': 'Exata', '3': 'Frase', '4': 'Ampla',
}

function brl(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }
function pct(n: number) { return `${n.toFixed(2)}%` }

export function ExportPdfButton({ from, to }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/report-data?from=${from}&to=${to}`)
      const data = await res.json()

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      const DARK: [number, number, number] = [17, 24, 39]
      const ACCENT: [number, number, number] = [99, 102, 241]
      const GREEN: [number, number, number] = [34, 197, 94]
      const GRAY: [number, number, number] = [100, 116, 139]
      const LIGHT: [number, number, number] = [248, 250, 252]
      const LIGHT2: [number, number, number] = [241, 245, 249]

      function addSectionTitle(title: string, y: number, color: [number, number, number] = ACCENT) {
        doc.setFillColor(...color)
        doc.rect(14, y, pageW - 28, 8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(title, 18, y + 5.5)
        return y + 12
      }

      function addSummaryRow(items: { label: string; value: string }[], y: number) {
        const colW = (pageW - 28) / items.length
        doc.setFontSize(8)
        items.forEach((item, i) => {
          const x = 14 + i * colW
          doc.setFillColor(...(i % 2 === 0 ? LIGHT : LIGHT2))
          doc.rect(x, y, colW, 14, 'F')
          doc.setTextColor(...GRAY)
          doc.setFont('helvetica', 'normal')
          doc.text(item.label, x + colW / 2, y + 5, { align: 'center' })
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.text(item.value, x + colW / 2, y + 11, { align: 'center' })
        })
        return y + 18
      }

      // Header
      doc.setFillColor(...DARK)
      doc.rect(0, 0, pageW, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Relatório de Tráfego Pago', 14, 13)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY)
      doc.text(`Período: ${from} até ${to}`, pageW - 14, 13, { align: 'right' })

      let y = 30

      // ── META ADS ──────────────────────────────────────────────
      const { meta } = data
      if (meta?.campaigns?.length > 0) {
        y = addSectionTitle('Meta Ads', y, ACCENT)

        const mt = meta.totals
        y = addSummaryRow([
          { label: 'Valor Usado', value: brl(mt.spend) },
          { label: 'Alcance', value: fmtInt(mt.reach) },
          { label: 'Resultado', value: fmtInt(mt.resultado) },
          { label: 'Custo/Resultado', value: mt.custo_resultado ? brl(mt.custo_resultado) : '—' },
          { label: 'Cliques', value: fmtInt(mt.clicks) },
          { label: 'CTR', value: pct(mt.ctr) },
        ], y)

        autoTable(doc, {
          startY: y,
          head: [['Campanha', 'Valor Usado', 'Alcance', 'Resultado', 'Custo/Result.', 'Cliques', 'CTR']],
          body: meta.campaigns.map((c: any) => [
            c.campaign_name,
            brl(c.spend),
            fmtInt(c.reach),
            c.resultado > 0 ? fmtInt(c.resultado) : '—',
            c.custo_resultado ? brl(c.custo_resultado) : '—',
            fmtInt(c.clicks),
            pct(c.ctr),
          ]),
          theme: 'striped',
          headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
          columnStyles: { 0: { cellWidth: 80 } },
        })
        y = (doc as any).lastAutoTable.finalY + 12
      }

      // ── GOOGLE ADS ────────────────────────────────────────────
      const { google } = data
      if (google?.campaigns?.length > 0) {
        if (y > pageH - 60) { doc.addPage(); y = 20 }

        y = addSectionTitle('Google Ads', y, GREEN)

        const gt = google.totals
        y = addSummaryRow([
          { label: 'Valor Usado', value: brl(gt.spend) },
          { label: 'Impressões', value: fmtInt(gt.impressions) },
          { label: 'Resultado', value: fmtInt(gt.conversions) },
          { label: 'Custo/Resultado', value: gt.custo_resultado ? brl(gt.custo_resultado) : '—' },
          { label: 'Cliques', value: fmtInt(gt.clicks) },
          { label: 'CTR', value: pct(gt.ctr) },
        ], y)

        autoTable(doc, {
          startY: y,
          head: [['Campanha', 'Valor Usado', 'Impressões', 'Resultado', 'Custo/Result.', 'Cliques', 'CTR']],
          body: google.campaigns.map((c: any) => [
            c.campaign_name,
            brl(c.spend),
            fmtInt(c.impressions),
            c.conversions > 0 ? fmtInt(Math.round(c.conversions)) : '—',
            c.custo_resultado ? brl(c.custo_resultado) : '—',
            fmtInt(c.clicks),
            pct(c.ctr),
          ]),
          theme: 'striped',
          headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
          columnStyles: { 0: { cellWidth: 80 } },
        })
        y = (doc as any).lastAutoTable.finalY + 12

        if (google.keywords?.length > 0) {
          if (y > pageH - 60) { doc.addPage(); y = 20 }

          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...DARK)
          doc.text('Palavras-chave (Top 30 por gasto)', 14, y)
          y += 5

          autoTable(doc, {
            startY: y,
            head: [['Palavra-chave', 'Tipo', 'Campanha', 'Valor Usado', 'Impressões', 'Resultado', 'Cliques', 'CTR']],
            body: google.keywords.map((k: any) => [
              k.keyword,
              MATCH_LABEL[k.match_type] || k.match_type || '—',
              k.campaign_name,
              brl(k.spend),
              fmtInt(k.impressions),
              k.conversions > 0 ? fmtInt(Math.round(k.conversions)) : '—',
              fmtInt(k.clicks),
              pct(k.ctr),
            ]),
            theme: 'striped',
            headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7.5 },
            margin: { left: 14, right: 14 },
            columnStyles: { 0: { cellWidth: 50 }, 2: { cellWidth: 55 } },
          })
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...GRAY)
        doc.text(
          `Página ${i} de ${pageCount}  •  Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
          pageW / 2,
          pageH - 5,
          { align: 'center' }
        )
      }

      doc.save(`relatorio-${from}-${to}.pdf`)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      {loading ? 'Gerando PDF...' : 'Exportar PDF'}
    </button>
  )
}
