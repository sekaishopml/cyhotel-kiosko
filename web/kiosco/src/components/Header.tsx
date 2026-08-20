import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Header() {
  const [checking, setChecking] = useState(false)
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null)

  const checkUpdate = async () => {
    setChecking(true)
    try {
      const res = await fetch('https://api.github.com/repos/CyHotel/web/releases/latest')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDialog({
        title: 'Actualización disponible',
        body: `Nueva versión: ${data.tag_name}\n${data.body || 'Sin descripción'}`,
      })
    } catch {
      setDialog({ title: 'Sin actualizaciones', body: 'Ya estás en la última versión.' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <header className="bg-verde-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-serif text-xl font-semibold tracking-wide">Hotel del Valle</h1>
        <button
          onClick={checkUpdate}
          disabled={checking}
          className="text-xs opacity-70 hover:opacity-100 transition-opacity font-sans disabled:opacity-40"
        >
          {checking ? 'Buscando…' : 'Actualizar'}
        </button>
      </header>

      <AnimatePresence>
        {dialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="font-serif text-xl text-verde-900 mb-2">{dialog.title}</h3>
              <p className="text-sm text-ink/70 whitespace-pre-line">{dialog.body}</p>
              <button
                onClick={() => setDialog(null)}
                className="mt-4 w-full bg-verde-900 text-white rounded-xl py-2 font-semibold text-sm"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
