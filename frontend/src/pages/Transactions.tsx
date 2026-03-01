import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import TransactionRow from '@/components/TransactionRow'
import EmptyState from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

interface NewTransaction {
  date: string
  description: string
  amount: string
  type: 'debit' | 'credit'
  category: string
}

const CATEGORIES = ['food', 'transport', 'bills', 'entertainment', 'shopping', 'health', 'education', 'others']

function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data: accounts } = await supabase.from('accounts').select('id')
      const ids = (accounts ?? []).map((a) => a.id)

      const { data } = await supabase
        .from('transactions')
        .select('id, date, description, amount, type, category')
        .in('account_id', ids.length ? ids : ['none'])
        .order('date', { ascending: false })

      return data ?? []
    },
  })
}

interface UploadResult {
  inserted: number
  duplicates_skipped: number
  total_parsed: number
}

export default function Transactions() {
  const { data, isLoading } = useTransactions()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewTransaction>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'debit',
    category: 'others',
  })
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError('')
    setUploadStatus(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const formData = new FormData()
      formData.append('file', file)
      formData.append('user_id', user.id)

      const res = await fetch('/api/parse_pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      let json: { error?: string; inserted?: number; duplicates_skipped?: number; total_parsed?: number }
      try {
        json = await res.json()
      } catch {
        throw new Error(`Server error (${res.status}) — check Vercel function logs`)
      }
      if (!res.ok) {
        if (res.status === 422) throw new Error('Unsupported format — only Public Bank credit card statements are supported')
        if (res.status === 400) throw new Error(json.error ?? 'Bad request')
        if (res.status === 500) throw new Error(`Parsing failed: ${json.error ?? 'unknown error'}`)
        throw new Error(json.error ?? `Upload failed (${res.status})`)
      }

      setUploadStatus(json as UploadResult)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      // Reset input so the same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const addMutation = useMutation({
    mutationFn: async (tx: NewTransaction) => {
      const amt = parseFloat(tx.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')

      // Get or create default account
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (!accounts?.length) {
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert({ user_id: user.id, bank_name: 'Default', account_type: 'savings' })
          .select('id')
          .single()
        if (error) throw error
        accounts = [newAccount]
      }

      const { error } = await supabase.from('transactions').insert({
        account_id: accounts[0].id,
        date: tx.date,
        description: tx.description || null,
        amount: amt,
        type: tx.type,
        category: tx.category,
        source: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category: 'others' })
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount) { setError('Amount is required'); return }
    addMutation.mutate(form)
  }

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
            <h1 className="text-xl font-semibold text-zinc-50">Transactions</h1>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                title="Upload PDF statement"
              >
                <Upload className="h-4 w-4 text-zinc-300" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowForm(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-4 w-4 text-white" />
              </motion.button>
            </div>
          </div>

          {isUploading && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-sm text-zinc-400">Parsing PDF...</p>
            </div>
          )}

          {uploadStatus && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-zinc-50">
                <span className="text-emerald-400 font-medium tabular-nums">{uploadStatus.inserted}</span>
                {' '}transactions imported
                {uploadStatus.duplicates_skipped > 0 && (
                  <span className="text-zinc-400"> · {uploadStatus.duplicates_skipped} skipped</span>
                )}
              </p>
              <button onClick={() => setUploadStatus(null)}>
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-red-900 bg-zinc-900 px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-red-400">Upload failed</p>
                  <p className="text-xs text-zinc-400">{uploadError}</p>
                </div>
                <button onClick={() => setUploadError('')} className="mt-0.5 shrink-0">
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-50">Add Transaction</p>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. McDonald's"
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'debit' | 'credit' })}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="debit">Debit (expense)</option>
                    <option value="credit">Credit (income)</option>
                  </select>
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
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={addMutation.isPending}
                className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {addMutation.isPending ? 'Saving...' : 'Add Transaction'}
              </motion.button>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded bg-zinc-800" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <EmptyState
              message="No transactions yet — add manually or upload a PDF statement"
              actionLabel="Upload PDF"
              onAction={() => fileInputRef.current?.click()}
            />
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4">
              {data?.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </motion.div>
  )
}
