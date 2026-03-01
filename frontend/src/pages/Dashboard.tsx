import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import StatCard from '@/components/StatCard'
import TransactionRow from '@/components/TransactionRow'
import EmptyState from '@/components/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'

interface Transaction {
  id: string
  date: string
  description: string | null
  amount: number
  type: 'debit' | 'credit'
  category: string | null
}

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, current_balance, currency')

      const accountIds = (accounts ?? []).map((a) => a.id)

      const { data: txns } = await supabase
        .from('transactions')
        .select('id, date, description, amount, type, category')
        .in('account_id', accountIds.length ? accountIds : ['none'])
        .gte('date', monthStart)
        .order('date', { ascending: false })

      const transactions: Transaction[] = txns ?? []

      const income = transactions
        .filter((t) => t.type === 'credit')
        .reduce((s, t) => s + Number(t.amount), 0)

      const expenses = transactions
        .filter((t) => t.type === 'debit')
        .reduce((s, t) => s + Number(t.amount), 0)

      const totalBalance = (accounts ?? []).reduce(
        (s, a) => s + Number(a.current_balance),
        0,
      )

      return { transactions, income, expenses, totalBalance }
    },
  })
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard()
  const navigate = useNavigate()
  const now = new Date()
  const monthName = now.toLocaleString('en-MY', { month: 'long', year: 'numeric' })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex min-h-full flex-col bg-zinc-950"
    >
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Overview</h1>
            <p className="text-sm text-zinc-400">{monthName}</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <StatCard
                  label="Total Balance"
                  value={formatCurrency(data?.totalBalance ?? 0)}
                />
              </div>
              <StatCard
                label="Income"
                value={formatCurrency(data?.income ?? 0)}
                valueClass="text-emerald-400"
              />
              <StatCard
                label="Expenses"
                value={formatCurrency(data?.expenses ?? 0)}
                valueClass="text-red-400"
              />
            </div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Recent Transactions</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded bg-zinc-800" />
                ))}
              </div>
            ) : data?.transactions.length === 0 ? (
              <EmptyState
                message="No transactions yet — upload your first statement"
                actionLabel="Add Transaction"
                onAction={() => navigate('/transactions')}
              />
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4">
                {data?.transactions.slice(0, 10).map((t) => (
                  <TransactionRow key={t.id} transaction={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </motion.div>
  )
}
