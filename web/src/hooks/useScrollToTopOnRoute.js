import { useEffect } from 'react'

export function useScrollToTopOnRoute(page) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page?.path])
}
