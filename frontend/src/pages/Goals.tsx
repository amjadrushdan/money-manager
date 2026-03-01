import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import EmptyState from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase
        .from('savings_goals')
        .select('id, name, target_amount, current_amount, deadline')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })
}

export default function Goals() {
  const { data, isLoading } = useGoals()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', target_amount: '', deadline: '' })
  const [error, setError] = useState('')

  const addMutation = useMutation({
    mutationFn: async () => {
      const target = parseFloat(form.target_amount)
      if (!form.name.trim()) throw new Error('Name is required')
      if (isNaN(target) || target <= 0) throw new Error('Invalid target amount')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        name: form.name.trim(),
        target_amount: target,
        current_amount: 0,
        deadline: form.deadline || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setShowForm(false)
      setForm({ name: '', target_amount: '', deadline: '' })
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
            <h1 className="text-xl font-semibold text-zinc-50">Savings Goals</h1>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          {showForm && (
            <form
              onSubmit={(e) => { e.preventDefault(); addMutation.mutate() }}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-50">New Goal</p>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Goal Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Emergency Fund"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400">Target Amount (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 tabular-nums"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400">Deadline (optional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={addMutation.isPending}
                className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {addMutation.isPending ? 'Saving...' : 'Create Goal'}
              </motion.button>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <EmptyState
              message="No goals yet — create your first savings goal"
              actionLabel="Create Goal"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="space-y-3">
              {data?.map((g) => {
                const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100)
                return (
                  <div key={g.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-100">{g.name}</p>
                      <p className="text-sm tabular-nums text-zinc-400">
                        {pct.toFixed(0)}%
                      </p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span className="tabular-nums">
                        {formatCurrency(Number(g.current_amount))} saved
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(Number(g.target_amount))} goal
                      </span>
                    </div>
                    {g.deadline && (
                      <p className="text-xs text-zinc-600">
                        Due {new Date(g.deadline + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </motion.div>
  )
}
