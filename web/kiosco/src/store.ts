import { create } from 'zustand'
import { AppScreen, RoomType } from './types'

// Fase 4-parcial: mismo estado/acciones que el Context anterior, ahora en zustand.
// La navegación URL vive en react-router (HashRouter en App.tsx); `screen` se
// mantiene como espejo de la ruta para no tocar la lógica existente
// (StepBar, idle-timer, guards) y `navDir` sigue alimentando slide-in-left/right.
interface StoreState {
  screen: AppScreen
  selectedPlan: string | null
  selectedRoom: string | null
  selectedExtra: string | null
  selectedDays: number
  catalog: RoomType[] | null
  navDir: 'forward' | 'back' | null
}

const INITIAL: StoreState = {
  screen: 'splash',
  selectedPlan: null,
  selectedRoom: null,
  selectedExtra: null,
  selectedDays: 1,
  catalog: null,
  navDir: 'forward',
}

function screenToStep(screen: AppScreen): number {
  return screen === 'plan' ? 0 : screen === 'room' ? 1 : 2
}

interface Store extends StoreState {
  step: number
  goTo: (screen: AppScreen, dir?: 'forward' | 'back' | null) => void
  selectPlan: (planKey: string) => void
  selectRoom: (roomKey: string) => void
  selectExtra: (extra: string | null) => void
  selectDays: (days: number) => void
  setCatalog: (types: RoomType[]) => void
  goBack: () => void
  goHome: () => void
}

export const useStore = create<Store>()((set) => ({
  ...INITIAL,
  step: screenToStep(INITIAL.screen),

  goTo: (screen: AppScreen, dir: 'forward' | 'back' | null = 'forward') => {
    set({ screen, navDir: dir, step: screenToStep(screen) })
  },

  selectPlan: (planKey: string) => {
    set({
      selectedPlan: planKey,
      selectedRoom: null,
      selectedExtra: null,
      selectedDays: 1,
      screen: 'room',
      navDir: 'forward',
      step: 1,
    })
  },

  selectRoom: (roomKey: string) => {
    set({ selectedRoom: roomKey })
  },

  selectExtra: (extra: string | null) => {
    set({ selectedExtra: extra })
  },

  selectDays: (days: number) => {
    set({ selectedDays: days })
  },

  setCatalog: (types: RoomType[]) => {
    set({ catalog: types })
  },

  goBack: () => {
    set((s) => {
      if (s.screen === 'checkin') return { ...s, screen: 'room', navDir: 'back', step: 1 }
      if (s.screen === 'room')
        return {
          ...s,
          screen: 'plan',
          selectedRoom: null,
          selectedExtra: null,
          selectedDays: 1,
          navDir: 'back',
          step: 0,
        }
      return s
    })
  },

  goHome: () => {
    set({ ...INITIAL, step: screenToStep(INITIAL.screen) })
    setTimeout(() => set({ screen: 'plan', navDir: 'back', step: 0 }), 0)
  },
}))
