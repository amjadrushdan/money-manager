import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string
  date: string
  description: string | null
  amount: number
  type: 'debit' | 'credit'
  category: string | null
}

interface TransactionRowProps {
  transaction: Transaction
}

export default function TransactionRow({ transaction }: TransactionRowProps) {
  const isCredit = transaction.type === 'credit'
  const displayAmount = isCredit ? transaction.amount : -transaction.amount

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {transaction.description ?? 'No description'}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-zinc-500">{formatDate(transaction.date)}</span>
          {transaction.category && (
            <span className="text-xs text-zinc-600">{transaction.category}</span>
          )}
        </div>
      </div>
      <p
        className={cn(
          'ml-4 shrink-0 text-sm font-medium tabular-nums',
          isCredit ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {formatCurrency(displayAmount)}
      </p>
    </div>
  )
}
