import { useEffect, useState, useRef } from 'react'
import { useStore } from './store'
import { syncPending } from './api'
import Header from './components/Header'
import StepBar from './components/StepBar'
import Splash from './components/Splash'
import PlanScreen from './screens/PlanScreen'
import RoomScreen from './screens/RoomScreen'
import CheckinScreen from './screens/CheckinScreen'

const ADMIN_PIN = '12345'
const APP_VERSION = import.meta.env.PACKAGE_VERSION || '1.1.8'

export default function App() {
  const { screen, step, goTo } = useStore()
  const [showPin, setShowPin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'ok' | 'available' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('kiosco_server') || window.location.origin)
  const pinRef = useRef<HTMLInputElement>(null)

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
    fetch('https://api.github.com/repos/sekaishopml/cyhotel-kiosko/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    }).then(r => r.json()).then(data => {
      const tag = data.tag_name || ''
      if (tag && tag !== `v${APP_VERSION}`) {
        setUpdateVersion(tag)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('ok')
      }
    }).catch(() => setUpdateStatus('error'))
  }

  const handleSaveServer = () => {
    const url = serverUrl.replace(/\/+$/, '')
    localStorage.setItem('kiosco_server', url)
    setShowServerConfig(false)
    window.location.reload()
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
          onClick={(e) => { e.stopPropagation(); setShowPin(true) }}
          className="text-[0.5rem] text-navy/25 font-semibold hover:text-navy/50 transition-colors"
        >
          v{APP_VERSION}
        </button>
      </footer>

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
              className={`w-full text-center text-2xl tracking-[0.3em] font-mono px-4 py-3 rounded-xl border-2 outline-none transition-all ${
                pinError
                  ? 'border-red-400 bg-red-50 animate-shake'
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
                onClick={handleCheckUpdate}
                disabled={updateStatus === 'checking'}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-navy/10 hover:bg-navy/5 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-navy/50 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2v4M10 14v4M2 10h4M14 10h4"/><circle cx="10" cy="10" r="3"/></svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-navy">
                    {updateStatus === 'checking' ? 'Buscando...' : 'Buscar actualización'}
                  </div>
                  {updateStatus === 'ok' && <div className="text-xs text-green-600 mt-0.5">Última versión: v{APP_VERSION}</div>}
                  {updateStatus === 'available' && <div className="text-xs text-amber-600 font-bold mt-0.5">Nueva: {updateVersion}</div>}
                  {updateStatus === 'error' && <div className="text-xs text-red-500 mt-0.5">Error al verificar</div>}
                </div>
              </button>

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
                    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#0F172A;text-align:center"><div><h2 style="font-size:1.5rem;font-weight:bold">Kiosco cerrado</h2><p style="opacity:.5;margin-top:.5rem">Puede apagar el dispositivo</p></div></div>'
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
              className="w-full px-4 py-3 rounded-xl border-2 border-navy/15 focus:border-gold outline-none text-sm font-mono"
              placeholder="http://68.168.20.219:8000"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowServerConfig(false)}
                className="flex-1 py-2.5 text-sm text-navy/50 border border-navy/10 rounded-xl hover:bg-navy/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveServer}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-navy rounded-xl hover:bg-navy/90"
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
