import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $me, fetchMe } from '@store/auth'
import { $customModes, loadCustomModes } from '@store/modes'
import { scheduleSync } from '@store/session'
import { $reducedMotion } from '@store/settings'

export function useAppBootstrap() {
  const me = useStore($me)
  const reducedMotion = useStore($reducedMotion)

  useEffect(() => {
    fetchMe()
  }, [])

  useEffect(() => {
    if (me) {
      loadCustomModes()
      // Upload any game played before signing in.
      scheduleSync(500)
    } else {
      $customModes.set([])
    }
  }, [me?.id])

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [reducedMotion])
}
