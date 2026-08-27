/// <reference types="vite/client" />

interface Window {
  __API_BASE__?: string
  Android?: {
    exitApp?: () => void
    checkForUpdate?: () => void
  }
}
