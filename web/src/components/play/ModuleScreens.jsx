import { useState } from 'react'
import { act } from '@store/session'
import { getMiniGame, inventoryOf, LUCK_EFFECTS } from '@/game'
import { difficultyLabel, rarityLabel } from '@/game/modules/shared'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { ActivityFrame, ActivityTimer, ContinueButton, Handoff, HoldToReveal, Outcome, PlayerChooser } from './parts'

const nameOf = (state, id) => state.players.find((p) => p.id === id)
const SkipButton = ({ name = 'skip', label = 'Пропусни' }) => (
  <Button variant="ghost" icon="skip_next" onClick={() => act(name)}>{label}</Button>
)

// --- Challenges ---------------------------------------------------------------

export function ChallengeScreen({ state, activity, player }) {
  const { challenge, timer, outcome, reward } = activity.data
  const config = state.modules.challenges.config
  const immunity = state.immunities[player.id] || 0
  const points = challenge.points ?? config.pointsOnSuccess

  if (activity.phase === 'result') {
    const map = {
      success: { tone: 'success', icon: '🎉', title: `Браво, ${player.name}!`, text: `+${points} точки${challenge.ongoing ? ' · ефектът е активен' : ''}` },
      fail: { tone: 'fail', icon: '😅', title: 'Не се получи този път', text: config.failAction === 'losePoint' ? '−1 точка' : config.failAction === 'none' ? '' : 'Следва наказание…' },
      immune: { tone: 'info', icon: '🛡️', title: 'Имунитет!', text: 'Предизвикателството е отменено без наказание' },
    }
    const o = map[outcome]
    return (
      <ActivityFrame icon="🎯" label="Предизвикателство" player={player} actions={<ContinueButton autoFocus />}>
        <Outcome {...o}>{reward && <p className="outcome__bonus">🎁 Бонус награда за успеха!</p>}</Outcome>
      </ActivityFrame>
    )
  }

  return (
    <ActivityFrame
      icon="🎯"
      label="Предизвикателство"
      player={player}
      actions={
        <>
          <Button variant="success" size="lg" icon="check" onClick={() => act('success')}>Успя</Button>
          <Button variant="danger" size="lg" icon="close" onClick={() => act('fail')}>Не успя</Button>
          {immunity > 0 && <Button variant="soft" icon="shield" onClick={() => act('useImmunity')}>Имунитет ({immunity})</Button>}
          <SkipButton />
        </>
      }
    >
      <div className="challenge">
        <div className="challenge__chips">
          <Chip tone={challenge.difficulty}>{difficultyLabel(challenge.difficulty)}</Chip>
          {challenge.category && <Chip>{challenge.category}</Chip>}
          <Chip tone="yellow" icon="star">{points} т.</Chip>
          {challenge.ongoing && <Chip tone="accent">🌀 {challenge.ongoingTurns || 1} хода</Chip>}
        </div>
        <h2 className="challenge__title">{challenge.title}</h2>
        <p className="challenge__body">{challenge.body}</p>
        {timer && <ActivityTimer timer={timer} size="lg" />}
      </div>
    </ActivityFrame>
  )
}

// --- Whisper ------------------------------------------------------------------

export function WhisperScreen({ state, activity, player }) {
  const { phrase, guesserId, readerId, attemptsLeft, timer, outcome } = activity.data
  const config = state.modules.whisper.config
  const guesser = nameOf(state, guesserId)
  const reader = nameOf(state, readerId)
  const label = 'Whisper Challenge'

  if (activity.phase === 'handoff') {
    return (
      <ActivityFrame icon="🎧" label={label} player={player} actions={<SkipButton />}>
        <div className="whisper-setup">
          <div className="whisper-setup__roles">
            <span><Avatar emoji={guesser.avatar} size="lg" /> <strong>{guesser.name}</strong> слага слушалките 🎧</span>
            <span><Avatar emoji={reader.avatar} size="lg" /> <strong>{reader.name}</strong> чете фразата 👄</span>
          </div>
          <p className="text-muted">Пуснете силна музика в слушалките. Само {reader.name} гледа екрана.</p>
          <Button size="lg" icon="lock_open" onClick={() => act('readerReady')}>{reader.name} е готов</Button>
        </div>
      </ActivityFrame>
    )
  }

  if (activity.phase === 'result') {
    const map = {
      correct: { tone: 'success', icon: '🎉', title: `${guesser.name} позна!`, text: config.scoring ? `+${config.pointsGuesser} за ${guesser.name}, +${config.pointsReader} за ${reader.name}` : '' },
      noAttempts: { tone: 'fail', icon: '🙉', title: 'Опитите свършиха' },
      timeout: { tone: 'fail', icon: '⏰', title: 'Времето изтече' },
      revealed: { tone: 'info', icon: '👀', title: 'Отговорът беше разкрит' },
    }
    return (
      <ActivityFrame icon="🎧" label={label} player={player} actions={<ContinueButton autoFocus />}>
        <Outcome {...map[outcome]}>
          <p className="whisper-answer">„{phrase.title}“</p>
        </Outcome>
      </ActivityFrame>
    )
  }

  return (
    <ActivityFrame
      icon="🎧"
      label={label}
      player={player}
      actions={
        activity.phase === 'reader' ? (
          <>
            <Button size="lg" icon="play_arrow" onClick={() => act('start')}>Старт на таймера</Button>
            <SkipButton />
          </>
        ) : (
          <>
            <Button variant="success" size="lg" icon="check" onClick={() => act('correct')}>Позна</Button>
            <Button variant="danger" icon="close" onClick={() => act('wrong')}>Грешен опит</Button>
            {config.allowReveal && <Button variant="ghost" icon="visibility" onClick={() => act('reveal')}>Покажи отговора</Button>}
            <SkipButton />
          </>
        )
      }
    >
      <div className="whisper">
        <p className="whisper__reader">Фраза за <strong>{reader.name}</strong>:</p>
        <HoldToReveal label="Задръж, за да видиш фразата">
          <span className="whisper__phrase">{phrase.title}</span>
        </HoldToReveal>
        {activity.phase === 'playing' && (
          <div className="whisper__status">
            <ActivityTimer timer={timer} expireAction="timeUp" size="lg" />
            <p className="whisper__attempts">
              Опити: {Array.from({ length: config.attempts }, (_, i) => (
                <span key={i} className={i < attemptsLeft ? 'dot dot--on' : 'dot'} aria-hidden="true" />
              ))}
              <span className="visually-hidden">{attemptsLeft} опита остават</span>
            </p>
          </div>
        )}
      </div>
    </ActivityFrame>
  )
}

// --- Gifts --------------------------------------------------------------------

function GiftCard({ gift, hidden }) {
  return (
    <div className={`gift-card gift-card--${gift.rarity} ${hidden ? 'gift-card--mystery' : ''}`}>
      <span className="gift-card__icon emoji" aria-hidden="true">{hidden ? '❓' : '🎁'}</span>
      <span className="gift-card__rarity">{rarityLabel(gift.rarity)}</span>
      <p className="gift-card__name">{hidden ? 'Мистериозна кутия' : gift.name}</p>
      {!hidden && gift.description && <p className="gift-card__description">{gift.description}</p>}
      {!hidden && gift.type === 'physical' && <span className="gift-card__type">Истински подарък</span>}
    </div>
  )
}

function ExchangeScreen({ state, activity, player }) {
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const items = state.moduleState.gifts.items
  const own = inventoryOf(state, player.id)
  const others = items.filter((i) => i.ownerId && i.ownerId !== player.id)
  const swap = activity.data.rule === 'swap'

  if (activity.phase === 'result') {
    const ex = activity.data.exchange
    const got = items.find((i) => i.id === ex.theirGiftId)
    return (
      <ActivityFrame icon="🔁" label="Размяна" player={player} actions={<ContinueButton autoFocus />}>
        <Outcome tone="success" icon="🔁" title={`${player.name} взе „${got?.name}“`} text={`от ${nameOf(state, ex.formerOwner)?.name}`} />
      </ActivityFrame>
    )
  }

  return (
    <ActivityFrame
      icon="🔁"
      label={swap ? 'Размяна на подаръци' : 'Открадни подарък'}
      player={player}
      actions={
        <>
          <Button size="lg" icon="swap_horiz" disabled={!theirs || (swap && !mine)} onClick={() => act('exchange', { myGiftId: mine, theirGiftId: theirs })}>
            {swap ? 'Размени' : 'Вземи'}
          </Button>
          <Button variant="ghost" onClick={() => act('cancel')}>Откажи</Button>
        </>
      }
    >
      {swap && (
        <>
          <p className="exchange__label">Твоят подарък</p>
          <div className="exchange__grid">
            {own.map((gift) => (
              <button key={gift.id} type="button" className={`exchange__item ${mine === gift.id ? 'is-selected' : ''}`} onClick={() => setMine(gift.id)}>
                🎁 {gift.name}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="exchange__label">{swap ? 'Срещу' : 'Избери подарък'}</p>
      <div className="exchange__grid">
        {others.map((gift) => {
          const owner = nameOf(state, gift.ownerId)
          return (
            <button key={gift.id} type="button" className={`exchange__item ${theirs === gift.id ? 'is-selected' : ''}`} onClick={() => setTheirs(gift.id)}>
              🎁 {gift.name} <small>{owner?.avatar} {owner?.name}</small>
            </button>
          )
        })}
      </div>
    </ActivityFrame>
  )
}

export function GiftScreen(props) {
  const { state, activity, player } = props
  if (activity.kind === 'exchange') return <ExchangeScreen {...props} />
  if (activity.kind === 'empty') {
    return (
      <ActivityFrame icon="🎁" label="Подаръци" player={player} actions={<ContinueButton label="Вземи +1 точка" autoFocus />}>
        <Outcome tone="info" icon="📭" title="Подаръците свършиха" text="Вместо подарък получаваш точка." />
      </ActivityFrame>
    )
  }
  const gift = state.moduleState.gifts.items.find((i) => i.id === activity.data.giftId)
  const recipient = nameOf(state, activity.data.recipientId)

  if (activity.phase === 'choose') {
    return (
      <ActivityFrame icon="🎁" label="Подарък" player={player}>
        <GiftCard gift={gift} hidden={gift.mystery && !gift.revealed} />
        <PlayerChooser players={state.players} label={`${player.name}, кой получава подаръка?`} onChoose={(playerId) => act('chooseRecipient', { playerId })} />
      </ActivityFrame>
    )
  }
  if (activity.phase === 'result') {
    const limit = activity.data.outcome === 'limit'
    return (
      <ActivityFrame icon="🎁" label="Подарък" player={player} actions={<ContinueButton autoFocus />}>
        {limit ? (
          <Outcome tone="info" icon="🙅" title={`${recipient?.name} вече има максимален брой подаръци`} />
        ) : (
          <Outcome tone="success" icon="🎉" title={`${recipient?.name} получи подарък!`}>
            <GiftCard gift={gift} />
          </Outcome>
        )}
      </ActivityFrame>
    )
  }
  const hidden = gift.mystery && !gift.revealed
  return (
    <ActivityFrame
      icon="🎁"
      label="Подарък"
      player={player}
      actions={
        hidden ? (
          <Button size="lg" icon="redeem" onClick={() => act('reveal')}>Отвори кутията</Button>
        ) : (
          <Button size="lg" icon="check" onClick={() => act('accept')} autoFocus>Подаръкът е за {recipient?.name}</Button>
        )
      }
    >
      <p className="gift-intro">Подаръкът е твой, <strong>{recipient?.name}</strong>!</p>
      <GiftCard gift={gift} hidden={hidden} />
    </ActivityFrame>
  )
}

// --- Luck cards ---------------------------------------------------------------

export function LuckCardScreen({ state, activity, player }) {
  const { card } = activity.data
  const effect = LUCK_EFFECTS[card.effect]
  const flipped = activity.phase === 'revealed'
  return (
    <ActivityFrame
      icon="🍀"
      label="Карта късмет"
      player={player}
      actions={
        !flipped ? (
          <Button size="lg" icon="flip" onClick={() => act('flip')} autoFocus>Обърни картата</Button>
        ) : effect?.needsTarget ? null : (
          <Button size="lg" icon="check" onClick={() => act('apply', {})} autoFocus>Приложи</Button>
        )
      }
    >
      <div className={`luck-card ${flipped ? 'luck-card--flipped' : ''} luck-card--${card.rarity || 'common'}`}>
        <div className="luck-card__inner">
          <div className="luck-card__back" aria-hidden={flipped}>
            <span className="emoji">🍀</span>
            <span>Дивотия</span>
          </div>
          <div className="luck-card__front" aria-hidden={!flipped}>
            <span className="luck-card__rarity">{rarityLabel(card.rarity)}</span>
            <p className="luck-card__title">{card.title}</p>
            <p className="luck-card__body">{card.body}</p>
            <span className="luck-card__effect">{effect?.label}</span>
          </div>
        </div>
      </div>
      {flipped && effect?.needsTarget && (
        <PlayerChooser players={state.players} excludeId={player.id} label="Избери играч" onChoose={(targetId) => act('apply', { targetId })} />
      )}
    </ActivityFrame>
  )
}

// --- Effects ------------------------------------------------------------------

export function EffectScreen({ state, activity, player }) {
  const { effect, targetId } = activity.data
  const config = state.modules.effects.config
  const target = nameOf(state, targetId || player.id)
  const immunity = state.immunities[target?.id] || 0
  if (activity.phase === 'choose') {
    return (
      <ActivityFrame icon="🌀" label="Продължаващ ефект" player={player}>
        <div className="effect-card">
          <p className="effect-card__title">{effect.title}</p>
          <p className="effect-card__body">{effect.body}</p>
        </div>
        <PlayerChooser players={state.players} label="За кого е ефектът?" onChoose={(playerId) => act('chooseTarget', { playerId })} />
      </ActivityFrame>
    )
  }
  const turns = effect.turns || config.defaultTurns
  return (
    <ActivityFrame
      icon="🌀"
      label="Продължаващ ефект"
      player={player}
      actions={
        <>
          <Button size="lg" icon="check" onClick={() => act('accept')} autoFocus>Приемам</Button>
          {immunity > 0 && <Button variant="soft" icon="shield" onClick={() => act('useImmunity')}>Имунитет ({immunity})</Button>}
        </>
      }
    >
      <div className="effect-card">
        <span className="effect-card__for"><Avatar emoji={target?.avatar} size="sm" /> {target?.name}</span>
        <p className="effect-card__title">{effect.title}</p>
        <p className="effect-card__body">{effect.body}</p>
        <Chip tone="accent">⏳ {turns} {turns === 1 ? 'ход' : 'хода'}</Chip>
      </div>
    </ActivityFrame>
  )
}

// --- Missions (uses the full, non-public state) -----------------------------

export function MissionScreen({ fullState, activity, player }) {
  const assignments = fullState.moduleState.missions.assignments.filter((a) => activity.data.assignmentIds.includes(a.id))
  if (activity.phase === 'handoff') {
    return (
      <ActivityFrame icon="🕵️" label="Тайна мисия" player={player}>
        <Handoff player={player} text="Мисията е тайна — никой друг не бива да я вижда." onReady={() => act('show')} />
      </ActivityFrame>
    )
  }
  return (
    <ActivityFrame icon="🕵️" label="Тайна мисия" player={player} actions={<Button size="lg" icon="visibility_off" onClick={() => act('hide')}>Запомних — скрий</Button>}>
      <HoldToReveal label="Задръж, за да видиш мисията">
        <div className="mission-secret">
          {assignments.map((a) => (
            <div key={a.id} className="mission-secret__item">
              <p className="mission-secret__title">{a.title}</p>
              <p className="mission-secret__text">{a.text}</p>
              <small>+{a.points} т.{a.deadlineRound ? ` · до рунд ${a.deadlineRound}` : ''}</small>
            </div>
          ))}
        </div>
      </HoldToReveal>
      <p className="text-muted center">Когато я изпълниш, кажи на домакина — той ще я отбележи в панела „Мисии“.</p>
    </ActivityFrame>
  )
}

// --- Drinking -----------------------------------------------------------------

export function DrinkingScreen({ state, activity, player }) {
  const { outcome } = activity.data
  const config = state.modules.drinking.config
  return (
    <ActivityFrame
      icon="🥃"
      label="Шот"
      player={player}
      actions={
        <>
          <Button size="lg" icon="local_bar" onClick={() => act('drink')}>Изпълнено</Button>
          <Button variant="secondary" size="lg" icon="local_cafe" onClick={() => act('alternative')}>Алтернатива</Button>
          {config.allowSkip && <SkipButton />}
        </>
      }
    >
      <div className="drink-card">
        <p className="drink-card__title">{outcome.title}</p>
        {outcome.body && <p className="drink-card__body">{outcome.body}</p>}
        <div className="drink-card__alt">
          <span className="emoji" aria-hidden="true">🧃</span>
          <span><small>Безалкохолна алтернатива (без наказание)</small>{outcome.alternative}</span>
        </div>
      </div>
      <p className="drink-note">Пийте отговорно. Всеки може да избере алтернативата по всяко време.</p>
    </ActivityFrame>
  )
}

// --- Mini-games ---------------------------------------------------------------

export function MiniGameScreen({ state, activity, player }) {
  const game = getMiniGame(activity.data.gameId)
  const { item, timer, outcome } = activity.data
  const config = state.modules.miniGames.config
  const label = `${game.name}`
  const icon = game.icon

  if (game.flow === 'quiz') {
    const answered = activity.phase === 'result'
    return (
      <ActivityFrame icon={icon} label={label} player={player} actions={answered ? <ContinueButton autoFocus /> : <SkipButton />}>
        <div className="quiz">
          <h2 className="quiz__question">{item.title}</h2>
          {!answered && <ActivityTimer timer={timer} />}
          <div className="quiz__options">
            {activity.data.options.map((option, index) => {
              const state2 = !answered ? '' : index === activity.data.answerIndex ? 'is-correct' : index === activity.data.selectedIndex ? 'is-wrong' : 'is-dim'
              return (
                <button key={index} type="button" className={`quiz__option ${state2}`} disabled={answered} onClick={() => act('answer', { index })}>
                  <span className="quiz__letter">{'АБВГДЕ'[index]}</span> {option}
                </button>
              )
            })}
          </div>
          {answered && (
            <Outcome tone={outcome === 'correct' ? 'success' : 'fail'} icon={outcome === 'correct' ? '🧠' : '🙈'} title={outcome === 'correct' ? `Вярно! +${config.pointsWin} т.` : 'Грешка'} />
          )}
        </div>
      </ActivityFrame>
    )
  }

  if (game.flow === 'rapid') {
    if (activity.phase === 'result') {
      return (
        <ActivityFrame icon={icon} label={label} player={player} actions={<ContinueButton autoFocus />}>
          <Outcome tone={outcome === 'success' ? 'success' : 'fail'} icon={outcome === 'success' ? '⚡' : '⏰'} title={outcome === 'success' ? `Успя! +${config.pointsWin} т.` : 'Не стигна времето'} />
        </ActivityFrame>
      )
    }
    return (
      <ActivityFrame
        icon={icon}
        label={label}
        player={player}
        actions={
          activity.phase === 'ready' ? (
            <>
              <Button size="lg" icon="play_arrow" onClick={() => act('start')} autoFocus>Старт</Button>
              <SkipButton />
            </>
          ) : (
            <>
              <Button variant="success" size="lg" icon="check" onClick={() => act('success')}>Успя</Button>
              <Button variant="danger" size="lg" icon="close" onClick={() => act('fail')}>Не успя</Button>
            </>
          )
        }
      >
        <div className="rapid">
          <p className="rapid__count">Назови {activity.data.targetCount}</p>
          <h2 className="rapid__title">{item.title}</h2>
          {item.body && <p className="text-muted">{item.body}</p>}
          {activity.phase === 'playing' && <ActivityTimer timer={timer} expireAction="timeUp" size="lg" controls={false} />}
        </div>
      </ActivityFrame>
    )
  }

  // performance
  if (activity.phase === 'result') {
    const guesser = nameOf(state, activity.data.guesserId)
    return (
      <ActivityFrame icon={icon} label={label} player={player} actions={<ContinueButton autoFocus />}>
        <Outcome
          tone={outcome === 'guessed' ? 'success' : 'fail'}
          icon={outcome === 'guessed' ? '🎉' : '🤷'}
          title={outcome === 'guessed' ? `${guesser?.name} позна!` : 'Никой не позна'}
          text={outcome === 'guessed' ? `+${config.pointsWin} за ${player.name}, +${config.pointsGuesser} за ${guesser?.name}` : ''}
        >
          <p className="whisper-answer">„{item.title}“{item.body ? ` — ${item.body}` : ''}</p>
        </Outcome>
      </ActivityFrame>
    )
  }
  return (
    <ActivityFrame
      icon={icon}
      label={label}
      player={player}
      actions={
        activity.phase === 'secret' ? (
          <>
            <Button size="lg" icon="play_arrow" onClick={() => act('start')}>Готов съм — старт</Button>
            <SkipButton />
          </>
        ) : (
          <Button variant="danger" icon="close" onClick={() => act('fail')}>Никой не позна</Button>
        )
      }
    >
      <div className="performance">
        <p className="performance__instructions">{game.instructions}</p>
        <HoldToReveal label={`${player.name}, задръж, за да видиш`}>
          <span className="whisper__phrase">{item.title}</span>
          {item.body && <span className="performance__hint">{item.body}</span>}
        </HoldToReveal>
        {activity.phase === 'playing' && (
          <>
            <ActivityTimer timer={timer} expireAction="timeUp" size="lg" />
            <PlayerChooser players={state.players} excludeId={player.id} label="Кой позна?" onChoose={(playerId) => act('guessed', { playerId })} />
          </>
        )}
      </div>
    </ActivityFrame>
  )
}
