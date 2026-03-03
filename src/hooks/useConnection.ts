import { useEffect } from 'react'
import { useConnectionStore } from '../store/connectionStore'

const HEALTH_URL = 'http://localhost:4000/health'
const INTERVAL_MS = 10_000

export function useConnection() {
  const setStatus = useConnectionStore((s) => s.setStatus)

  useEffect(() => {
    const ping = async () => {
      try {
        const res = await fetch(HEALTH_URL)
        setStatus(res.ok ? 'connected' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    ping()
    const id = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(id)
  }, [setStatus])
}
