import { useEffect, useState } from 'react'

// Re-renders on an interval while `active` (used by timers).
export function useNow(active, intervalMs = 200) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return active ? now : Date.now()
}
