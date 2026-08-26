import { useEffect } from 'react'
import { useStore } from './store'
import { syncPending } from './api'
import Header from './components/Header'
import StepBar from './components/StepBar'
import Splash from './components/Splash'
import PlanScreen from './screens/PlanScreen'
import RoomScreen from './screens/RoomScreen'
import CheckinScreen from './screens/CheckinScreen'

export default function App() {
  const { screen, step, goTo } = useStore()

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
        <span className="text-[0.5rem] text-navy/25 font-semibold">v1.0.8</span>
      </footer>
    </div>
  )
}
