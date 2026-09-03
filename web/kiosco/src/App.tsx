import { useEffect, useState, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { AppScreen } from './types'
import { syncPending, getKioscoConfig, checkVersion } from './api'
import { shouldInstall } from './lib/version'
import Header from './components/ui/Header'
import StepBar from './components/ui/StepBar'
import Splash from './components/ui/Splash'
import PlanScreen from './screens/PlanScreen'
import RoomScreen from './screens/RoomScreen'
import CheckinScreen from './screens/CheckinScreen'
import IdleScreen from './screens/IdleScreen'

const ADMIN_PIN = '12345'
const APP_VERSION = import.meta.env.PACKAGE_VERSION || '1.1.8'

// Fase 4-parcial: HashRouter (ver reporte). La ruta es la URL; `screen` del
// store se mantiene como espejo para no tocar la lógica del shell
// (StepBar, idle-timer, bloqueos) ni las animaciones slide-in por navDir.
const PATH_SCREEN: Record<string, AppScreen> = {
  '/splash': 'splash',
  '/plan': 'plan',
  '/room': 'room',
  '/checkin': 'checkin',
}

// Sincroniza store.screen con la URL (deep-link, back del navegador).
// Las navegaciones normales ya actualizan el store antes de navegar,
// así que aquí normalmente es no-op.
function RouteSync() {
  const location = useLocation()
  const screen = useStore((s) => s.screen)
  const goTo = useStore((s) => s.goTo)
  useEffect(() => {
    const target = PATH_SCREEN[location.pathname] ?? 'splash'
    if (target !== screen) {
      const order: AppScreen[] = ['plan', 'room', 'checkin']
      const cur = order.indexOf(screen)
      const nxt = order.indexOf(target)
      const dir = cur !== -1 && nxt !== -1 && nxt < cur ? 'back' : 'forward'
      goTo(target, dir)
    }
  }, [location.pathname, screen, goTo])
  return null
}

// Guard: /room exige plan → redirect a /plan.
function RequirePlan({ children }: { children: React.ReactElement }) {
  const selectedPlan = useStore((s) => s.selectedPlan)
  if (!selectedPlan) return <Navigate to="/plan" replace />
  return children
}

// Guard: /checkin exige plan+room → redirect a /plan.
function RequireCheckin({ children }: { children: React.ReactElement }) {
  const selectedPlan = useStore((s) => s.selectedPlan)
  const selectedRoom = useStore((s) => s.selectedRoom)
  if (!selectedPlan || !selectedRoom) return <Navigate to="/plan" replace />
  return children
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

function Shell() {
  const { screen, step, goTo, navDir } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPin, setShowPin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'ok' | 'available' | 'error' | 'downloading' | 'installing' | 'cancelled'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateMeta, setUpdateMeta] = useState<{ downloadUrl: string; sha256: string; size: number } | null>(null)
  const [updateProgress, setUpdateProgress] = useState(0)
  const [swUpdate, setSwUpdate] = useState(false)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('kiosco_server') || window.location.origin)
  const pinRef = useRef<HTMLInputElement>(null)
  const [showIdle, setShowIdle] = useState(false)
  const idleSec = useRef<number>(60)
  const idleTimeout = useRef<number | null>(null)

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
    if (showPin) {
      setPinInput('')
      setPinError(false)
      setTimeout(() => pinRef.current?.focus(), 100)
    }
  }, [showPin])

  useEffect(() => {
    ;(window as any).__updateStatus = (status: string, extra?: string) => {
      if (status === 'checking') {
        setUpdateStatus('checking')
      } else if (status === 'available') {
        setUpdateVersion(extra || '')
        setUpdateStatus('available')
      } else if (status === 'latest') {
        setUpdateStatus('ok')
      } else if (status === 'downloading') {
        setUpdateStatus('downloading')
        setUpdateProgress(parseInt(extra || '0', 10))
      } else if (status === 'installing') {
        setUpdateStatus('installing')
      } else if (status === 'cancelled') {
        setUpdateStatus('idle')
      } else if (status === 'error') {
        setUpdateStatus('error')
      }
    }
    return () => { delete (window as any).__updateStatus }
  }, [])

  useEffect(() => {
    const onSwUpdated = () => setSwUpdate(true)
    window.addEventListener('kiosco:sw-updated', onSwUpdated)
    return () => window.removeEventListener('kiosco:sw-updated', onSwUpdated)
  }, [])

  useEffect(() => {
    let active = true
    getKioscoConfig().then(c => {
      if (!active) return
      idleSec.current = c.idle_timeout_seconds || 60
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const clearIdleTimer = () => {
    if (idleTimeout.current !== null) {
      window.clearTimeout(idleTimeout.current)
      idleTimeout.current = null
    }
  }

  const blocked = screen === 'splash' || showPin || showAdmin || showServerConfig || showIdle

  useEffect(() => {
    const arm = () => {
      clearIdleTimer()
      if (blocked || screen !== 'plan') return
      idleTimeout.current = window.setTimeout(() => setShowIdle(true), idleSec.current * 1000)
    }
    const reset = () => { if (!showIdle) arm() }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'touchstart']
    evs.forEach(ev => window.addEventListener(ev, reset))
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (!showIdle) {
          clearIdleTimer()
          arm()
        }
      } else {
        clearIdleTimer()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    arm()
    return () => {
      evs.forEach(ev => window.removeEventListener(ev, reset))
      document.removeEventListener('visibilitychange', onVis)
      clearIdleTimer()
    }
  }, [blocked, showIdle, screen])

  const handleSplashDone = () => {
    goTo('plan')
    navigate('/plan')
    setShowIdle(true)
  }

  const handlePinSubmit = () => {
    if (pinInput === ADMIN_PIN) {
      setShowPin(false)
      setShowAdmin(true)
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 1500)
      setPinInput('')
    }
  }

  const handleCheckUpdate = () => {
    setUpdateStatus('checking')
    // Fuente: LAN (/api/kiosco-update). Semver estricto, sin GitHub directo desde la web.
    checkVersion().then(info => {
      if (info && shouldInstall(info.version, APP_VERSION, info.minVersion)) {
        setUpdateVersion(info.version)
        setUpdateMeta({ downloadUrl: info.download_url, sha256: info.sha256, size: info.size })
        setUpdateStatus('available')
      } else if (info) {
        setUpdateStatus('ok')
      } else {
        setUpdateStatus('error')
      }
    }).catch(() => setUpdateStatus('error'))
  }

  const hasNativeUpdater = typeof window.Android?.downloadUpdate === 'function'

  const handleDownloadInstall = () => {
    if (hasNativeUpdater && updateMeta && updateVersion) {
      try {
        window.Android!.downloadUpdate!(updateMeta.downloadUrl, updateVersion, updateMeta.sha256, updateMeta.size)
      } catch {
        setUpdateStatus('error')
      }
      return
    }
    // Fallback navegador: la LAN es la fuente — la versión + URL quedan
    // visibles en el panel para descarga manual (sin GitHub directo).
  }

  const handleSaveServer = () => {
    const url = serverUrl.replace(/\/+$/, '')
    localStorage.setItem('kiosco_server', url)
    setShowServerConfig(false)
    window.location.reload()
  }

  const isSplashRoute = location.pathname === '/splash'
  const isPlanRoute = location.pathname === '/plan'

  if (isSplashRoute) {
    return (
      <>
        <RouteSync />
        <Splash onDone={handleSplashDone} />
      </>
    )
  }

  return (
    <div className="kiosk-shell bg-cream">
      <RouteSync />
      {swUpdate && (
        <button
          onClick={() => window.location.reload()}
          className="fixed top-0 left-0 right-0 z-[200] w-full px-4 py-3 bg-navy text-white text-sm font-semibold text-center shadow-lg"
        >
          Nueva vista disponible — toque para recargar
        </button>
      )}
      {showIdle && (
        <IdleScreen
          onStart={() => setShowIdle(false)}
          onAdmin={() => { setShowIdle(false); setShowPin(true) }}
          version={APP_VERSION}
        />
      )}
      {!showIdle && (
        <>
          {isPlanRoute && <Header />}
          {isPlanRoute && <StepBar step={step} />}
          <div className={`kiosk-content pointer-events-auto ${navDir === 'back' ? 'slide-in-left' : 'slide-in-right'}`} key={location.pathname}>
            <Routes>
              <Route path="/plan" element={<PlanScreen />} />
              <Route path="/room" element={<RequirePlan><RoomScreen /></RequirePlan>} />
              <Route path="/checkin" element={<RequireCheckin><CheckinScreen /></RequireCheckin>} />
              <Route path="/" element={<Navigate to="/splash" replace />} />
              <Route path="*" element={<Navigate to="/splash" replace />} />
            </Routes>
          </div>
          {/* Mantenimiento: punto mínimo superpuesto, sin ocupar layout ni causar desborde */}
          <div className="kiosk-maint" style={{ pointerEvents: 'none' }}>
            <button
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                e.nativeEvent.stopImmediatePropagation()
                setShowPin(true)
              }}
              aria-label="Mantenimiento"
              className="kiosk-maint-btn"
              style={{ pointerEvents: 'auto', touchAction: 'none' }}
            >
              v{APP_VERSION}
            </button>
          </div>
        </>
      )}

      {showPin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-[popIn_0.2s_ease-out]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPin(false) }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-navy mb-1 font-display text-center">
              PIN del administrador
            </h2>
            <p className="text-xs text-navy/40 text-center mb-5">Ingrese el PIN de acceso</p>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit() }}
              className={`w-full text-center text-2xl tracking-[0.3em] font-mono px-4 py-3 rounded-lg border-2 outline-none transition-all ${
                pinError
                  ? 'border-red-400 bg-red-50 animate-shake'
                  : 'border-navy/15 focus:border-gold'
              }`}
              placeholder="••••••••••"
            />
            {pinError && (
              <p className="text-sm text-red-500 font-semibold mt-2 text-center">PIN incorrecto</p>
            )}
            <button
              onClick={handlePinSubmit}
              className="w-full mt-4 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-navy/90 transition-colors"
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

      {showAdmin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-[popIn_0.2s_ease-out]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAdmin(false) }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="font-display font-bold text-navy text-lg leading-tight">HOTEL</div>
              <div className="font-display font-bold text-navy text-2xl leading-tight">DEL VALLE</div>
              <p className="text-[10px] text-navy/40 mt-1 uppercase tracking-wider font-bold">Panel de administración</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={updateStatus === 'available' ? handleDownloadInstall : handleCheckUpdate}
                disabled={updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'installing'}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-navy/10 hover:bg-navy/5 transition-colors text-left"
              >
                <svg className={`w-5 h-5 text-navy/50 shrink-0 ${updateStatus === 'checking' || updateStatus === 'downloading' ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2v4M10 14v4M2 10h4M14 10h4"/><circle cx="10" cy="10" r="3"/></svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-navy">
                    {updateStatus === 'checking' && 'Buscando...'}
                    {updateStatus === 'downloading' && `Descargando ${updateProgress}%`}
                    {updateStatus === 'installing' && 'Instalando...'}
                    {updateStatus === 'available' && 'Descargar e instalar'}
                    {updateStatus === 'idle' && 'Buscar actualización'}
                    {updateStatus === 'ok' && 'Buscar actualización'}
                    {updateStatus === 'error' && 'Buscar actualización'}
                  </div>
                  {updateStatus === 'ok' && <div className="text-xs text-green-600 mt-0.5">Última versión: v{APP_VERSION}</div>}
                  {updateStatus === 'available' && <div className="text-xs text-amber-600 font-bold mt-0.5">Nueva: {updateVersion} — toque para instalar</div>}
                  {updateStatus === 'downloading' && (
                    <div className="w-full bg-navy/10 rounded-full h-1.5 mt-1.5">
                      <div className="bg-gold h-1.5 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }} />
                    </div>
                  )}
                  {updateStatus === 'installing' && <div className="text-xs text-blue-600 mt-0.5">El kiosco se reiniciará automáticamente</div>}
                  {updateStatus === 'error' && <div className="text-xs text-red-500 mt-0.5">Error al verificar</div>}
                </div>
              </button>
              {updateStatus === 'available' && !hasNativeUpdater && updateMeta?.downloadUrl && (
                <div className="text-xs text-navy/60 px-1">
                  <div className="font-semibold">Descarga manual desde la LAN:</div>
                  <div className="font-mono break-all">{updateMeta.downloadUrl}</div>
                </div>
              )}

              <button
                onClick={() => setShowServerConfig(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-navy/10 hover:bg-navy/5 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-navy/50 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="2.5"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M3.4 3.4l2.1 2.1M14.5 14.5l2.1 2.1M3.4 16.6l2.1-2.1M14.5 5.5l2.1-2.1"/></svg>
                <div className="text-sm font-semibold text-navy">Configurar servidor</div>
              </button>

              <button
                onClick={() => {
                  if (window.Android?.exitApp) {
                    window.Android.exitApp()
                  } else {
                    window.close()
                    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#123526;text-align:center"><div><h2 style="font-size:1.5rem;font-weight:bold">Kiosco cerrado</h2><p style="opacity:.5;margin-top:.5rem">Puede apagar el dispositivo</p></div></div>'
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2v6M4.9 4.9l4.2 4.2M15.1 4.9l-4.2 4.2M3 13a7 7 0 0014 0"/></svg>
                <div className="text-sm font-semibold text-red-600">Salir del kiosco</div>
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-navy/10 text-center">
              <div className="text-[10px] text-navy/30">v{APP_VERSION}</div>
            </div>

            <button
              onClick={() => setShowAdmin(false)}
              className="w-full mt-3 py-2 text-sm text-navy/40 hover:text-navy/70 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showServerConfig && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-[popIn_0.2s_ease-out]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowServerConfig(false) }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-navy mb-1 font-display text-center">Configurar servidor</h2>
            <p className="text-xs text-navy/40 text-center mb-4">URL del backend del kiosco</p>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-gold outline-none text-sm font-mono"
              placeholder="http://68.168.20.219:8000"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowServerConfig(false)}
                className="flex-1 py-2.5 text-sm text-navy/50 border border-navy/10 rounded-lg hover:bg-navy/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveServer}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-navy rounded-lg hover:bg-navy/90"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
