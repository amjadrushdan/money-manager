import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  valueClass?: string
  sublabel?: string
}

export default function StatCard({ label, value, valueClass, sublabel }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', valueClass ?? 'text-zinc-50')}>
        {value}
      </p>
      {sublabel && <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>}
    </div>
  )
}
