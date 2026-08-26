import { Routes, Route, useNavigate } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import PlanScreen from './screens/PlanScreen'
import RoomScreen from './screens/RoomScreen'
import CheckinScreen from './screens/CheckinScreen'
import Header from './components/Header'
import { syncPending } from './lib/offlineQueue'

interface AppState {
  selectedPlan: string | null
  selectedRoom: string | null
  selectedExtra: string | null
  selectedDays: number
}

export default function App() {
  const navigate = useNavigate()
  const [state, setState] = useState<AppState>({
    selectedPlan: null,
    selectedRoom: null,
    selectedExtra: null,
    selectedDays: 1
  })

  const selectPlan = useCallback((planKey: string) => {
    setState(prev => ({ ...prev, selectedPlan: planKey, selectedRoom: null, selectedExtra: null, selectedDays: 1 }))
    navigate('/room')
  }, [navigate])

  const selectRoom = useCallback((roomKey: string) => {
    setState(prev => ({ ...prev, selectedRoom: roomKey }))
  }, [])

  const selectExtra = useCallback((extra: string | null) => {
    setState(prev => ({ ...prev, selectedExtra: extra }))
  }, [])

  const selectDays = useCallback((days: number) => {
    setState(prev => ({ ...prev, selectedDays: days }))
  }, [])

  const goBack = useCallback(() => navigate(-1), [navigate])

  const goHome = useCallback(() => {
    setState({ selectedPlan: null, selectedRoom: null, selectedExtra: null, selectedDays: 1 })
    navigate('/')
  }, [navigate])

  // Reintenta enviar las reservas guardadas offline (cola 24/7).
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

  return (
    <div className="h-full flex flex-col bg-white">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<PlanScreen onSelect={selectPlan} />} />
            <Route path="/room" element={
              <RoomScreen
                planKey={state.selectedPlan!}
                selectedRoom={state.selectedRoom}
                selectedExtra={state.selectedExtra}
                selectedDays={state.selectedDays}
                onSelectRoom={selectRoom}
                onSelectExtra={selectExtra}
                onSelectDays={selectDays}
                onBack={goBack}
                onContinue={() => navigate('/checkin')}
              />
            } />
            <Route path="/checkin" element={
              <CheckinScreen
                planKey={state.selectedPlan!}
                roomKey={state.selectedRoom!}
                extra={state.selectedExtra}
                days={state.selectedDays}
                onBack={goBack}
                onSuccess={goHome}
              />
            } />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}
