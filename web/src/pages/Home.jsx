import { useStore } from '@nanostores/react'
import { $me } from '@store/auth'
import { startDraft } from '@store/draft'
import { $allModes } from '@store/modes'
import { go } from '@store/router'
import { $session } from '@store/session'
import { defaultSegments, listModules } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import ModeCard from '@/components/game/ModeCard'
import WheelGraphic from '@/components/game/WheelGraphic'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Logo from '@/components/ui/Logo'

const STEPS = [
  { icon: '🎉', title: 'Избери повод', text: 'Коледа, рожден ден, парти или свой режим — темата се сменя автоматично.' },
  { icon: '👯', title: 'Добави играчите', text: 'Имена и аватари. Без регистрация за всеки — играете на едно устройство.' },
  { icon: '🧩', title: 'Сглоби играта', text: 'Включи модулите, които искаш, и ги настрой — или остави умните настройки.' },
  { icon: '🚀', title: 'Започнете дивотията', text: 'Колело, предизвикателства, подаръци, мисии… Играта води сама.' },
]

const HERO_SEGMENTS = defaultSegments().slice(0, 8)

export default function Home() {
  const modes = useStore($allModes)
  const me = useStore($me)
  const session = useStore($session)
  const modules = listModules()

  const chooseMode = (mode) => {
    startDraft(mode)
    go('setupStep', { step: 'players' })
  }

  return (
    <SiteLayout>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <Logo size="xl" tagline href={null} />
            <p className="hero__lead">
              Игри, предизвикателства и много забавление за всякакви поводи. Събери компанията, сглоби своя игра от модули и започнете дивотията!
            </p>
            <div className="hero__actions">
              <Button size="xl" iconEnd="arrow_forward" href="/new">Създай игра</Button>
              {session && session.status !== 'finished' ? (
                <Button size="lg" variant="secondary" icon="play_arrow" href="/play">Продължи „{session.title}“</Button>
              ) : (
                <Button size="lg" variant="secondary" icon="auto_stories" href="/library">Разгледай библиотеката</Button>
              )}
            </div>
            <p className="hero__note">
              <Icon name="bolt" /> {me ? 'Игрите, съдържанието и историята ти се пазят в профила.' : 'Без регистрация. С профил запазваш игри, съдържание и история.'}
            </p>
          </div>
          <div className="hero__visual" aria-hidden="true">
            <div className="hero__wheel">
              <WheelGraphic segments={HERO_SEGMENTS} showLabels={false} className="wheel-graphic--idle" />
              <span className="hero__hub">Завърти</span>
            </div>
            <div className="hero__float hero__float--1"><span className="emoji">🎁</span> Подаръкът е твой!</div>
            <div className="hero__float hero__float--2"><span className="emoji">🎧</span> Whisper Challenge</div>
            <div className="hero__float hero__float--3"><span className="emoji">🍀</span> Тегли късмет!</div>
            <div className="hero__avatars">
              {['🦊', '🥳', '😎', '🦄', '🤠'].map((a) => <span key={a} className="emoji">{a}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section container">
        <div className="home-section__head">
          <span className="eyebrow">Стъпка 1</span>
          <h2 className="section-title">Какъв е поводът?</h2>
          <p className="text-muted">Режимът задава тема и предлага модули. Винаги можеш да промениш всичко.</p>
        </div>
        <div className="mode-grid">
          {modes.map((mode) => (
            <ModeCard key={mode.key} mode={mode} onSelect={chooseMode} />
          ))}
        </div>
      </section>

      <section className="home-section container">
        <div className="home-section__head">
          <span className="eyebrow">Модулна игра</span>
          <h2 className="section-title">Сглоби своята вечер</h2>
          <p className="text-muted">Всеки модул е отделна механика с настройки. Комбинирай ги свободно в една игра.</p>
        </div>
        <div className="module-showcase">
          {modules.map((module) => (
            <article key={module.id} className="module-showcase__item">
              <span className="module-showcase__icon emoji" aria-hidden="true">{module.icon}</span>
              <div>
                <h3 className="module-showcase__name">
                  {module.name}
                  {module.adultsOnly && <span className="chip chip--red">18+</span>}
                </h3>
                <p className="module-showcase__text">{module.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section container">
        <div className="home-steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="home-steps__item">
              <span className="home-steps__num">{i + 1}</span>
              <span className="home-steps__icon emoji" aria-hidden="true">{step.icon}</span>
              <h3 className="home-steps__title">{step.title}</h3>
              <p className="home-steps__text">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section container">
        <div className="home-cta">
          <div>
            <h2 className="section-title">Всяка дивотия създава история!</h2>
            <p className="text-muted">Сподели свои предизвикателства, фрази и готови игри с общността — или вземи техните.</p>
          </div>
          <div className="row">
            <Button size="lg" href="/new" iconEnd="arrow_forward">Започни сега</Button>
            {!me && <Button size="lg" variant="secondary" href="/register">Създай профил</Button>}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
