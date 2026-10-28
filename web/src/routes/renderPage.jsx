import { PROTECTED_ROUTES } from '@store/router'
import Home from '@/pages/Home'
import Setup from '@/pages/Setup'
import Play from '@/pages/Play'
import Summary from '@/pages/Summary'
import Library from '@/pages/Library'
import Preset from '@/pages/Preset'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import MyContent from '@/pages/MyContent'
import MyModes from '@/pages/MyModes'
import HistoryDetail from '@/pages/HistoryDetail'
import Account from '@/pages/Account'
import NotFound from '@/pages/NotFound'

const PAGES = {
  home: Home,
  setup: Setup,
  setupStep: Setup,
  play: Play,
  summary: Summary,
  library: Library,
  preset: Preset,
  login: Login,
  register: Register,
  dashboard: Dashboard,
  myContent: MyContent,
  myModes: MyModes,
  history: HistoryDetail,
  account: Account,
}

export function renderPage(page, { authReady, me }) {
  const Page = page && PAGES[page.route]
  if (!Page) return <NotFound />
  if (PROTECTED_ROUTES.has(page.route) && !(authReady && me)) return null
  return <Page params={page.params} search={page.search} />
}
