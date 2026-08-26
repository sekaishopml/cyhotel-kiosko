import { motion } from 'framer-motion'

export default function LoadingShimmer() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid gap-[var(--gap)] p-[var(--pad)]"
    >
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[var(--room-h)] min-h-[var(--tap)] rounded-2xl shimmer" />
      ))}
    </motion.div>
  )
}
