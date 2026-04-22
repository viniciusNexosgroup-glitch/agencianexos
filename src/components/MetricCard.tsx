type Color = 'indigo' | 'green' | 'yellow' | 'red' | 'slate'

const colorMap: Record<Color, string> = {
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  green:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  yellow: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  red:    'text-red-400 bg-red-500/10 border-red-500/20',
  slate:  'text-slate-300 bg-slate-500/10 border-slate-700',
}

interface Props {
  label: string
  value: string
  icon: string
  color?: Color
}

export function MetricCard({ label, value, icon, color = 'slate' }: Props) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
