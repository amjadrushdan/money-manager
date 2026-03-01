import { motion } from 'framer-motion'

interface EmptyStateProps {
  message: string
  actionLabel: string
  onAction: () => void
}

export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <p className="text-sm text-zinc-400">{message}</p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onAction}
        className="h-11 rounded-lg bg-indigo-600 px-6 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
      >
        {actionLabel}
      </motion.button>
    </motion.div>
  )
}
