import { useState, useCallback, createContext, useContext, useMemo, createElement } from 'react'
import { AppScreen } from './types'

interface StoreState {
  screen: AppScreen
  selectedPlan: string | null
  selectedRoom: string | null
  selectedExtra: string | null
  selectedDays: number
}

const INITIAL: StoreState = {
  screen: 'splash',
  selectedPlan: null,
  selectedRoom: null,
  selectedExtra: null,
  selectedDays: 1,
}

interface Store extends StoreState {
  step: number
  goTo: (screen: AppScreen) => void
  selectPlan: (planKey: string) => void
  selectRoom: (roomKey: string) => void
  selectExtra: (extra: string | null) => void
  selectDays: (days: number) => void
  goBack: () => void
  goHome: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(INITIAL)

  const goTo = useCallback((screen: AppScreen) => {
    setState(s => ({ ...s, screen }))
  }, [])

  const selectPlan = useCallback((planKey: string) => {
    setState(s => ({ ...s, selectedPlan: planKey, selectedRoom: null, selectedExtra: null, selectedDays: 1, screen: 'room' }))
  }, [])

  const selectRoom = useCallback((roomKey: string) => {
    setState(s => ({ ...s, selectedRoom: roomKey }))
  }, [])

  const selectExtra = useCallback((extra: string | null) => {
    setState(s => ({ ...s, selectedExtra: extra }))
  }, [])

  const selectDays = useCallback((days: number) => {
    setState(s => ({ ...s, selectedDays: days }))
  }, [])

  const goBack = useCallback(() => {
    setState(s => {
      if (s.screen === 'checkin') return { ...s, screen: 'room' }
      if (s.screen === 'room') return { ...s, screen: 'plan', selectedRoom: null, selectedExtra: null, selectedDays: 1 }
      return s
    })
  }, [])

  const goHome = useCallback(() => {
    setState(INITIAL)
    setTimeout(() => setState(s => ({ ...s, screen: 'plan' })), 0)
  }, [])

  const step = state.screen === 'plan' ? 0 : state.screen === 'room' ? 1 : 2

  const value = useMemo(() => ({
    ...state,
    step,
    goTo,
    selectPlan,
    selectRoom,
    selectExtra,
    selectDays,
    goBack,
    goHome,
  }), [state, step, goTo, selectPlan, selectRoom, selectExtra, selectDays, goBack, goHome])

  return createElement(StoreContext.Provider, { value }, children)
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
