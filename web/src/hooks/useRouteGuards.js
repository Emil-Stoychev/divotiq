import { useEffect } from 'react'
import { PROTECTED_ROUTES, go } from '@store/router'

export function useRouteGuards({ authReady, me, page }) {
  useEffect(() => {
    if (!authReady || !page) return
    if (PROTECTED_ROUTES.has(page.route) && !me) {
      go('login', {}, { next: page.path })
      return
    }
    if ((page.route === 'login' || page.route === 'register') && me) {
      const next = page.search?.next
      if (next && next.startsWith('/') && !next.startsWith('//')) window.location.replace(next)
      else go('dashboard')
    }
  }, [authReady, me, page])
}
