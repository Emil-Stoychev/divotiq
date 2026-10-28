import { useStore } from '@nanostores/react'
import { $authReady, $me } from '@store/auth'
import { router } from '@store/router'
import { useAppBootstrap } from '@/hooks/useAppBootstrap'
import { useRouteGuards } from '@/hooks/useRouteGuards'
import { useScrollToTopOnRoute } from '@/hooks/useScrollToTopOnRoute'
import { useThemeForRoute } from '@/hooks/useThemeForRoute'
import { renderPage } from '@/routes/renderPage'
import ThemeBackdrop from '@/components/effects/ThemeBackdrop'
import Toaster from '@/components/ui/Toaster'

export default function App() {
  const page = useStore(router)
  const me = useStore($me)
  const authReady = useStore($authReady)

  useAppBootstrap()
  useScrollToTopOnRoute(page)
  useRouteGuards({ authReady, me, page })
  const theme = useThemeForRoute(page)

  return (
    <>
      <ThemeBackdrop theme={theme} />
      {renderPage(page, { authReady, me })}
      <Toaster />
    </>
  )
}
