import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import EmptyState from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'

const CATEGORIES = ['food', 'transport', 'bills', 'entertainment', 'shopping', 'health', 'education', 'others']

function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: budgets } = await supabase
        .from('budgets')
        .select('id, category, monthly_limit, month')
        .eq('user_id', user.id)
        .eq('month', month)

      // Get spending per category for this month
      const monthStart = `${month}-01`
      const { data: accounts } = await supabase.from('accounts').select('id')
      const ids = (accounts ?? []).map((a) => a.id)

      const { data: txns } = await supabase
        .from('transactions')
        .select('category, amount, type')
        .in('account_id', ids.length ? ids : ['none'])
        .gte('date', monthStart)
        .eq('type', 'debit')

      const spending: Record<string, number> = {}
      for (const t of txns ?? []) {
        if (t.category) spending[t.category] = (spending[t.category] ?? 0) + Number(t.amount)
      }

      return (budgets ?? []).map((b) => ({
        ...b,
        spent: spending[b.category] ?? 0,
        pct: Math.min(((spending[b.category] ?? 0) / Number(b.monthly_limit)) * 100, 100),
      }))
    },
  })
}

export default function Budget() {
  const { data, isLoading } = useBudgets()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'food', monthly_limit: '' })
  const [error, setError] = useState('')

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const addMutation = useMutation({
    mutationFn: async () => {
      const limit = parseFloat(form.monthly_limit)
      if (isNaN(limit) || limit <= 0) throw new Error('Invalid amount')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('budgets').upsert({
        user_id: user.id,
        category: form.category,
        monthly_limit: limit,
        month,
      }, { onConflict: 'user_id,category,month' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      setShowForm(false)
      setForm({ category: 'food', monthly_limit: '' })
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex min-h-full flex-col bg-zinc-950"
    >
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-zinc-50">Budget</h1>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          <p className="text-sm text-zinc-400">
            {now.toLocaleString('en-MY', { month: 'long', year: 'numeric' })}
          </p>

          {showForm && (
            <form
              onSubmit={(e) => { e.preventDefault(); addMutation.mutate() }}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-50">Set Budget</p>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Monthly Limit (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthly_limit}
                  onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 tabular-nums"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={addMutation.isPending}
                className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {addMutation.isPending ? 'Saving...' : 'Save Budget'}
              </motion.button>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <EmptyState
              message="No budgets set — add your first budget"
              actionLabel="Add Budget"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="space-y-3">
              {data?.map((b) => (
                <div key={b.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize text-zinc-100">{b.category}</p>
                    <p className={cn('text-sm tabular-nums', b.pct >= 100 ? 'text-red-400' : b.pct >= 80 ? 'text-amber-400' : 'text-zinc-400')}>
                      {formatCurrency(b.spent)} / {formatCurrency(Number(b.monthly_limit))}
                    </p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        b.pct >= 100 ? 'bg-red-400' : b.pct >= 80 ? 'bg-amber-400' : 'bg-indigo-500',
                      )}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {formatCurrency(Math.max(Number(b.monthly_limit) - b.spent, 0))} remaining
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </motion.div>
  )
}
