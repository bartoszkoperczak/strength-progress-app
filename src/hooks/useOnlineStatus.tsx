import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return online
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white">
      <WifiOff className="h-4 w-4" />
      You are offline. Changes may not save until connection returns.
    </div>
  )
}
