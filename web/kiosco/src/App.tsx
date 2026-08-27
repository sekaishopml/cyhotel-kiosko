import { useEffect, useState } from 'react'
import { useStore } from './store'
import { syncPending } from './api'
import Header from './components/Header'
import StepBar from './components/StepBar'
import Splash from './components/Splash'
import PlanScreen from './screens/PlanScreen'
import RoomScreen from './screens/RoomScreen'
import CheckinScreen from './screens/CheckinScreen'

const ADMIN_PIN = '12345'

export default function App() {
  const { screen, step, goTo } = useStore()
  const [showPin, setShowPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  useEffect(() => {
    const tick = () => { syncPending().catch(() => {}) }
    const id = setInterval(tick, 30000)
    window.addEventListener('online', tick)
    tick()
    return () => {
      clearInterval(id)
      window.removeEventListener('online', tick)
    }
  }, [])

  useEffect(() => {
    if (!showPin) {
      setPinInput('')
      setPinError(false)
    }
  }, [showPin])

  const handlePinSubmit = () => {
    if (pinInput === ADMIN_PIN) {
      setShowPin(false)
      const base = window.location.origin
      window.open(`${base.replace(':8000', ':8001')}/`, '_blank')
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 1500)
      setPinInput('')
    }
  }

  if (screen === 'splash') {
    return <Splash onDone={() => goTo('plan')} />
  }

  return (
    <div className="h-full flex flex-col bg-cream">
      {screen !== 'room' && <Header />}
      {screen !== 'room' && <StepBar step={step} />}
      <main className="flex-1 min-h-0 overflow-hidden">
        {screen === 'plan' && <PlanScreen />}
        {screen === 'room' && <RoomScreen />}
        {screen === 'checkin' && <CheckinScreen />}
      </main>
      <footer className="shrink-0 text-center py-1 bg-cream">
        <button
          onClick={() => setShowPin(true)}
          className="text-[0.5rem] text-navy/25 font-semibold hover:text-navy/50 transition-colors"
        >
          v1.1.6
        </button>
      </footer>

      {showPin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setShowPin(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-navy mb-1 font-display text-center">
              PIN del administrador
            </h2>
            <p className="text-xs text-navy/40 text-center mb-5">Ingrese el PIN de acceso</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit() }}
              className={`w-full text-center text-2xl tracking-[0.3em] font-mono px-4 py-3 rounded-xl border-2 outline-none transition-all ${
                pinError
                  ? 'border-red-400 bg-red-50 animate-[shake_0.3s_ease-in-out]'
                  : 'border-navy/15 focus:border-gold'
              }`}
              placeholder="•••••"
            />
            <button
              onClick={handlePinSubmit}
              className="w-full mt-4 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors"
            >
              Ingresar
            </button>
            <button
              onClick={() => setShowPin(false)}
              className="w-full mt-2 py-2 text-sm text-navy/40 hover:text-navy/70 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
