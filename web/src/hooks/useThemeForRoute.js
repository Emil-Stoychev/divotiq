import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $draft } from '@store/draft'
import { $session } from '@store/session'

// Game modes influence the whole UI through <html data-theme>.
export function useThemeForRoute(page) {
  const session = useStore($session)
  const draft = useStore($draft)
  const route = page?.route

  let theme = 'classic'
  if ((route === 'play' || route === 'summary') && session) theme = session.theme
  else if ((route === 'setup' || route === 'setupStep') && draft) theme = draft.theme

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return theme
}
