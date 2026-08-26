import { useState, useCallback } from 'react'
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

export function useStore() {
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
    // Skip splash on return
    setTimeout(() => setState(s => ({ ...s, screen: 'plan' })), 0)
  }, [])

  const step = state.screen === 'plan' ? 0 : state.screen === 'room' ? 1 : 2

  return {
    ...state,
    step,
    goTo,
    selectPlan,
    selectRoom,
    selectExtra,
    selectDays,
    goBack,
    goHome,
  }
}
