/// <reference types="vite/client" />

interface Window {
  __API_BASE__?: string
  __updateStatus?: (status: string, extra?: string) => void
  Android?: {
    exitApp?: () => void
    checkAndUpdate?: () => void
    downloadUpdate?: (url: string, tag: string, sha256: string, size: number) => void
    getAppVersion?: () => string
  }
}
