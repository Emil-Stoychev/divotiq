import { useEffect, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { $authReady, $me, logout } from '@store/auth'
import { router } from '@store/router'
import { $session } from '@store/session'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Logo from '@/components/ui/Logo'

const NAV = [
  { route: 'home', href: '/', label: 'Начало', icon: 'home' },
  { route: 'setup', href: '/new', label: 'Нова игра', icon: 'celebration', match: ['setup', 'setupStep'] },
  { route: 'library', href: '/library', label: 'Библиотека', icon: 'auto_stories' },
  { route: 'dashboard', href: '/my', label: 'Моите игри', icon: 'stadia_controller', match: ['dashboard', 'history', 'myContent', 'myModes'] },
]

function isActive(item, route) {
  return (item.match || [item.route]).includes(route)
}

function UserMenu({ me }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-menu__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Avatar emoji={me.avatar} size="sm" />
        <span className="user-menu__name">{me.name}</span>
        <Icon name="expand_more" />
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <a role="menuitem" href="/my" onClick={() => setOpen(false)}><Icon name="stadia_controller" /> Моите игри</a>
          <a role="menuitem" href="/my/content" onClick={() => setOpen(false)}><Icon name="library_books" /> Моето съдържание</a>
          <a role="menuitem" href="/my/modes" onClick={() => setOpen(false)}><Icon name="palette" /> Моите режими</a>
          <a role="menuitem" href="/account" onClick={() => setOpen(false)}><Icon name="manage_accounts" /> Профил и настройки</a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); logout() }}>
            <Icon name="logout" /> Изход
          </button>
        </div>
      )}
    </div>
  )
}

export default function SiteLayout({ children, wide = false }) {
  const page = useStore(router)
  const me = useStore($me)
  const authReady = useStore($authReady)
  const session = useStore($session)
  const route = page?.route
  const hasActiveGame = session && session.status !== 'finished'

  return (
    <div className="site">
      <header className="site-header">
        <div className="container site-header__inner">
          <Logo size="sm" />
          <nav className="site-nav" aria-label="Основна навигация">
            {NAV.map((item) => (
              <a key={item.route} href={item.href} className={`site-nav__link ${isActive(item, route) ? 'site-nav__link--active' : ''}`} aria-current={isActive(item, route) ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="site-header__actions">
            {hasActiveGame && route !== 'play' && (
              <Button size="sm" variant="accent" icon="play_arrow" href="/play" className="site-header__resume" aria-label="Продължи играта" title="Продължи играта">
                Продължи играта
              </Button>
            )}
            {me ? (
              <UserMenu me={me} />
            ) : !authReady ? null : (
              <>
                <Button size="sm" variant="ghost" href="/login">Вход</Button>
                <Button size="sm" variant="secondary" href="/register" className="site-header__register">Регистрация</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`site-main ${wide ? 'site-main--wide' : ''}`}>{children}</main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <Logo size="sm" tagline href={null} />
          <p className="site-footer__text">Парти игри за всеки повод. Направено с ♥ за дълги вечери с приятели.</p>
          <a href="/account" className="site-footer__link">Настройки на звука и анимациите</a>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Мобилна навигация">
        {NAV.map((item) => (
          <a key={item.route} href={item.href} className={`tabbar__item ${isActive(item, route) ? 'tabbar__item--active' : ''} ${item.route === 'setup' ? 'tabbar__item--cta' : ''}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
        <a href={me ? '/account' : '/login'} className={`tabbar__item ${['account', 'login', 'register'].includes(route) ? 'tabbar__item--active' : ''}`}>
          <Icon name="person" />
          <span>Профил</span>
        </a>
      </nav>
    </div>
  )
}
