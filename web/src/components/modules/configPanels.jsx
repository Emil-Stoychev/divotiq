import { useState } from 'react'
import { SYSTEM_CHALLENGES, SYSTEM_DRINKING, SYSTEM_EFFECTS, SYSTEM_GIFTS, SYSTEM_LUCK_CARDS, SYSTEM_MISSIONS, SYSTEM_WHISPER_PHRASES, filterByMode } from '@/game/content'
import { kindsForModule, MINI_GAME_KIND_TO_GAME } from '@/game/content/kinds'
import { availableSegments, defaultSegments, EXCHANGE_RULES, FAIL_ACTIONS, listMiniGames, SUCCESS_REWARDS } from '@/game'
import { createId } from '@/game/engine/ids'
import { rarityLabel, RARITIES } from '@/game/modules/shared'
import ContentPicker from '@/components/content/ContentPicker'
import WheelGraphic from '@/components/game/WheelGraphic'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import NumberStepper from '@/components/ui/NumberStepper'
import Segmented from '@/components/ui/Segmented'
import Toggle from '@/components/ui/Toggle'
import { ChipToggleGroup, ConfigErrors, ConfigSection, ContentSourcePanel, CustomItemsEditor } from './common'
import SegmentsEditor from './SegmentsEditor'

const fieldError = (errors, field) => errors.find((e) => e.field === field)?.message

const optionList = (list, enabledModules) =>
  list.map((item) => ({
    value: item.id,
    label: item.requires && !enabledModules.includes(item.requires) ? `${item.label} (модулът е изключен)` : item.label,
    disabled: Boolean(item.requires && !enabledModules.includes(item.requires)),
  }))

function WheelPanel({ config, onChange, errors, context }) {
  const [picking, setPicking] = useState(false)
  const active = availableSegments(config, context.enabledModules)
  return (
    <>
      <div className="wheel-config">
        <div className="wheel-config__preview">
          <WheelGraphic segments={active.length ? active : config.segments} probability={config.probability} showLabels />
          <p className="text-muted">{active.length} активни сегмента</p>
        </div>
        <div className="wheel-config__settings">
          <Segmented
            label="Шанс"
            value={config.probability}
            onChange={(probability) => onChange({ probability })}
            options={[
              { value: 'equal', label: 'Равен' },
              { value: 'weighted', label: 'Тегловен' },
            ]}
          />
          <NumberStepper label="Продължителност на въртенето" value={config.spinSeconds} min={2} max={10} suffix=" сек." onChange={(spinSeconds) => onChange({ spinSeconds })} />
          <Toggle id="wheel-once" label="Еднократни сегменти изчезват" description="Сегменти с 1× се махат, след като се паднат" checked={config.removeOneTime} onChange={(removeOneTime) => onChange({ removeOneTime })} />
          <Toggle id="wheel-sound" label="Звук при въртене" checked={config.sound} onChange={(sound) => onChange({ sound })} />
        </div>
      </div>
      <ConfigSection title="Сегменти" description="Всеки сегмент води към модул или има свое действие.">
        <SegmentsEditor segments={config.segments} probability={config.probability} enabledModules={context.enabledModules} onChange={(segments) => onChange({ segments })} />
        <div className="row">
          <Button variant="ghost" size="sm" icon="restart_alt" onClick={() => onChange({ segments: defaultSegments() })}>Стандартни сегменти</Button>
          <Button variant="ghost" size="sm" icon="travel_explore" onClick={() => setPicking(true)}>Колело от библиотеката</Button>
        </div>
        <ConfigErrors errors={errors} />
      </ConfigSection>
      <ContentPicker
        open={picking}
        onClose={() => setPicking(false)}
        kinds={['wheel_preset']}
        onPick={([preset]) => preset && onChange({ segments: preset.data.segments.map((s) => ({ ...s, id: createId('seg') })) })}
      />
    </>
  )
}

function ChallengesPanel({ config, onChange, errors, context }) {
  const categories = [...new Set(filterByMode(SYSTEM_CHALLENGES, context.theme).map((c) => c.category))]
  return (
    <>
      <ConfigSection title="Правила">
        <Toggle id="ch-timer" label="Таймер" description="Отброяване за всяко предизвикателство" checked={config.useTimer} onChange={(useTimer) => onChange({ useTimer })} />
        {config.useTimer && (
          <NumberStepper label="Време по подразбиране" value={config.defaultDurationSec} min={5} max={600} step={5} suffix=" сек." onChange={(defaultDurationSec) => onChange({ defaultDurationSec })} hint={fieldError(errors, 'defaultDurationSec')} />
        )}
        <NumberStepper label="Точки за успех" hint="Ако предизвикателството няма свои" value={config.pointsOnSuccess} min={0} max={10} onChange={(pointsOnSuccess) => onChange({ pointsOnSuccess })} />
        <Select label="При неуспех" value={config.failAction} onChange={(failAction) => onChange({ failAction })} options={optionList(FAIL_ACTIONS, context.enabledModules)} error={fieldError(errors, 'failAction')} />
        <Select label="Награда при успех" value={config.successReward} onChange={(successReward) => onChange({ successReward })} options={optionList(SUCCESS_REWARDS, context.enabledModules)} error={fieldError(errors, 'successReward')} />
        {config.successReward !== 'none' && (
          <NumberStepper label="Шанс за награда" value={config.rewardChance} min={5} max={100} step={5} suffix="%" onChange={(rewardChance) => onChange({ rewardChance })} />
        )}
        <Toggle id="ch-ongoing" label="Продължаващи предизвикателства" description="Напр. „говори с акцент до следващия си ход“" checked={config.includeOngoing} onChange={(includeOngoing) => onChange({ includeOngoing })} />
        <ChipToggleGroup label="Категории" hint="Без избрани = всички" options={categories.map((c) => ({ value: c, label: c }))} value={config.categories || []} onChange={(cats) => onChange({ categories: cats })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('challenges')} systemCount={filterByMode(SYSTEM_CHALLENGES, context.theme).length} errors={errors} />
    </>
  )
}

function WhisperPanel({ config, onChange, errors, context }) {
  return (
    <>
      <ConfigSection title="Правила" description="Играчът със слушалките чете по устните. Фразата вижда само четецът.">
        <NumberStepper label="Време за рунд" value={config.durationSec} min={10} max={300} step={5} suffix=" сек." onChange={(durationSec) => onChange({ durationSec })} hint={fieldError(errors, 'durationSec')} />
        <NumberStepper label="Опити" value={config.attempts} min={1} max={10} onChange={(attempts) => onChange({ attempts })} />
        <Segmented
          label="Кой чете фразата"
          value={config.readerSelection}
          onChange={(readerSelection) => onChange({ readerSelection })}
          options={[
            { value: 'next', label: 'Следващият играч' },
            { value: 'random', label: 'Случаен' },
          ]}
        />
        <Toggle id="wh-scoring" label="Точки" checked={config.scoring} onChange={(scoring) => onChange({ scoring })} />
        {config.scoring && (
          <div className="config-grid">
            <NumberStepper label="За познал" value={config.pointsGuesser} min={0} max={10} onChange={(pointsGuesser) => onChange({ pointsGuesser })} />
            <NumberStepper label="За четеца" value={config.pointsReader} min={0} max={10} onChange={(pointsReader) => onChange({ pointsReader })} />
          </div>
        )}
        <Toggle id="wh-reveal" label="Бутон „Покажи отговора“" checked={config.allowReveal} onChange={(allowReveal) => onChange({ allowReveal })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('whisper')} systemCount={filterByMode(SYSTEM_WHISPER_PHRASES, context.theme).length} errors={errors} />
    </>
  )
}

function GiftsPanel({ config, onChange, errors }) {
  const [draftName, setDraftName] = useState('')
  const addGift = () => {
    const name = draftName.trim()
    if (!name) return
    onChange({ gifts: [...(config.gifts || []), { id: createId('gift'), name, description: '', rarity: 'common', type: 'physical', mystery: false }] })
    setDraftName('')
  }
  const updateGift = (id, patch) => onChange({ gifts: config.gifts.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  return (
    <>
      <ConfigSection title="Подаръци" description="Истинските подаръци само се разпределят — приложението пази кой какво е спечелил.">
        <Toggle id="gf-default" label="Виртуални награди" description={`${SYSTEM_GIFTS.length} забавни награди (корона, право на вето…)`} checked={config.useDefaultGifts} onChange={(useDefaultGifts) => onChange({ useDefaultGifts })} />
        <form
          className="gift-add"
          onSubmit={(e) => {
            e.preventDefault()
            addGift()
          }}
        >
          <input className="input" placeholder="напр. Чаша с надпис, шоколад…" value={draftName} maxLength={80} onChange={(e) => setDraftName(e.target.value)} aria-label="Име на подаръка" />
          <Button type="submit" icon="add" disabled={!draftName.trim()}>Добави</Button>
        </form>
        {(config.gifts || []).length > 0 && (
          <ul className="gift-list">
            {config.gifts.map((gift) => (
              <li key={gift.id} className={`gift-list__item gift-list__item--${gift.rarity}`}>
                <span className="emoji" aria-hidden="true">{gift.mystery ? '❓' : '🎁'}</span>
                <input className="input gift-list__name" value={gift.name} maxLength={80} onChange={(e) => updateGift(gift.id, { name: e.target.value })} aria-label="Име" />
                <select className="input input--select gift-list__rarity" value={gift.rarity} onChange={(e) => updateGift(gift.id, { rarity: e.target.value })} aria-label="Рядкост">
                  {RARITIES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <button type="button" className={`gift-list__mystery ${gift.mystery ? 'is-on' : ''}`} onClick={() => updateGift(gift.id, { mystery: !gift.mystery })} aria-pressed={gift.mystery} title="Мистериозна кутия — съдържанието се разкрива при награждаване">
                  ❓
                </button>
                <Button variant="ghost" size="sm" icon="delete" aria-label="Премахни" onClick={() => onChange({ gifts: config.gifts.filter((g) => g.id !== gift.id) })} />
              </li>
            ))}
          </ul>
        )}
        <CustomItemsEditor
          items={[]}
          kinds={['gift']}
          emptyText="Можеш да добавиш и подаръци от библиотеката."
          onChange={(added) => onChange({ gifts: [...(config.gifts || []), ...added.map((g) => ({ ...g, type: 'physical' }))] })}
        />
        <ConfigErrors errors={errors} />
      </ConfigSection>
      <ConfigSection title="Правила">
        <Segmented
          label="Кой получава подаръка"
          value={config.recipient}
          onChange={(recipient) => onChange({ recipient })}
          options={[
            { value: 'current', label: 'Играчът на ход' },
            { value: 'choose', label: 'Играчът избира' },
          ]}
        />
        <Toggle id="gf-exchange" label="Размени" description="Карти късмет могат да предизвикат размяна" checked={config.allowExchange} onChange={(allowExchange) => onChange({ allowExchange })} />
        {config.allowExchange && <Select label="Тип размяна" value={config.exchangeRule} onChange={(exchangeRule) => onChange({ exchangeRule })} options={EXCHANGE_RULES.map((r) => ({ value: r.id, label: r.label }))} />}
        <NumberStepper label="Максимум подаръци на играч" hint="0 = без лимит" value={config.maxPerPlayer} min={0} max={20} onChange={(maxPerPlayer) => onChange({ maxPerPlayer })} />
        <Segmented
          label="Когато подаръците свършат"
          value={config.whenEmpty}
          onChange={(whenEmpty) => onChange({ whenEmpty })}
          options={[
            { value: 'points', label: '+1 точка' },
            { value: 'skip', label: 'Пропусни' },
          ]}
        />
        <div className="rarity-weights">
          <span className="field__label">Шанс по рядкост</span>
          {RARITIES.map((r) => (
            <NumberStepper
              key={r.id}
              label={rarityLabel(r.id)}
              value={config.rarityWeights?.[r.id] ?? r.weight}
              min={0}
              max={100}
              step={5}
              onChange={(value) => onChange({ rarityWeights: { ...config.rarityWeights, [r.id]: value } })}
            />
          ))}
        </div>
      </ConfigSection>
    </>
  )
}

function LuckCardsPanel({ config, onChange, errors, context }) {
  return (
    <>
      <ConfigSection title="Правила">
        <NumberStepper label="Колко пъти може да се падне една карта" hint="0 = без лимит" value={config.usageLimit} min={0} max={10} onChange={(usageLimit) => onChange({ usageLimit })} />
        <Toggle id="lc-neg" label="Карти с наказание" description="Напр. „Пропусни следващия си ход“" checked={config.allowNegative} onChange={(allowNegative) => onChange({ allowNegative })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('luckCards')} withDifficulties={false} systemCount={filterByMode(SYSTEM_LUCK_CARDS, context.theme).length} errors={errors} />
    </>
  )
}

function EffectsPanel({ config, onChange, errors, context }) {
  return (
    <>
      <ConfigSection title="Правила" description="Ефектите остават активни няколко хода на засегнатия играч и се виждат в класирането.">
        <NumberStepper label="Продължителност по подразбиране" value={config.defaultTurns} min={1} max={10} suffix=" хода" onChange={(defaultTurns) => onChange({ defaultTurns })} />
        <NumberStepper label="Максимум активни ефекта на играч" value={config.maxPerPlayer} min={1} max={5} onChange={(maxPerPlayer) => onChange({ maxPerPlayer })} hint={fieldError(errors, 'maxPerPlayer')} />
        <Segmented
          label="За кого е ефектът"
          value={config.target}
          onChange={(target) => onChange({ target })}
          options={[
            { value: 'self', label: 'За играча на ход' },
            { value: 'choose', label: 'Играчът избира' },
          ]}
        />
        <NumberStepper label="Точки за приемане" value={config.pointsOnAccept} min={0} max={5} onChange={(pointsOnAccept) => onChange({ pointsOnAccept })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('effects')} withDifficulties={false} systemCount={filterByMode(SYSTEM_EFFECTS, context.theme).length} errors={errors} />
    </>
  )
}

function MissionsPanel({ config, onChange, errors, context }) {
  return (
    <>
      <ConfigErrors errors={errors.filter((e) => e.field === 'players')} />
      <ConfigSection title="Правила" description="Мисията вижда само собственикът ѝ. Домакинът отбелязва изпълнението от панела „Мисии“.">
        <Toggle id="ms-start" label="Раздай мисии в началото" description="Иначе мисии идват само от колелото" checked={config.assignOnStart} onChange={(assignOnStart) => onChange({ assignOnStart })} />
        {config.assignOnStart && <NumberStepper label="Мисии на играч" value={config.missionsPerPlayer} min={1} max={3} onChange={(missionsPerPlayer) => onChange({ missionsPerPlayer })} />}
        <NumberStepper label="Точки за изпълнена мисия" hint="Ако мисията няма свои" value={config.pointsOnComplete} min={0} max={10} onChange={(pointsOnComplete) => onChange({ pointsOnComplete })} />
        <NumberStepper label="Срок" hint="0 = до края на играта" value={config.deadlineRounds} min={0} max={20} suffix=" рунда" onChange={(deadlineRounds) => onChange({ deadlineRounds })} />
        <Toggle id="ms-reveal" label="Разкрий мисиите в края" checked={config.revealOnFinish} onChange={(revealOnFinish) => onChange({ revealOnFinish })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('missions')} systemCount={filterByMode(SYSTEM_MISSIONS, context.theme).length} errors={errors} />
    </>
  )
}

function DrinkingPanel({ config, onChange, errors, context }) {
  return (
    <>
      <div className={`adult-confirm ${config.adultsConfirmed ? 'adult-confirm--ok' : ''}`}>
        <span className="emoji" aria-hidden="true">🔞</span>
        <div>
          <strong>Само за пълнолетни</strong>
          <p>Всяко действие има безалкохолна алтернатива, без наказание. Пийте отговорно и никога не карайте след пиене.</p>
          <Toggle id="dr-adults" label="Потвърждавам, че всички, които играят този модул, са навършили 18 години" checked={config.adultsConfirmed} onChange={(adultsConfirmed) => onChange({ adultsConfirmed })} />
        </div>
      </div>
      <ConfigErrors errors={errors.filter((e) => e.field === 'adultsConfirmed')} />
      <ConfigSection title="Правила">
        <NumberStepper label="Максимум глътки" value={config.maxSips} min={1} max={5} onChange={(maxSips) => onChange({ maxSips })} />
        <Toggle id="dr-skip" label="Може да се пропуска" checked={config.allowSkip} onChange={(allowSkip) => onChange({ allowSkip })} />
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('drinking')} withDifficulties={false} systemCount={filterByMode(SYSTEM_DRINKING, context.theme).length} errors={errors} />
    </>
  )
}

function MiniGamesPanel({ config, onChange, errors }) {
  const games = listMiniGames()
  const setGame = (id, patch) => onChange({ games: { ...config.games, [id]: { ...config.games[id], ...patch } } })
  const customFor = (gameId) => (config.customItems || []).filter((i) => MINI_GAME_KIND_TO_GAME[i.kind] === gameId).length
  return (
    <>
      <ConfigSection title="Игри">
        <div className="minigame-list">
          {games.map((game) => {
            const entry = config.games?.[game.id] || game.defaults
            return (
              <div key={game.id} className={`minigame-list__item ${entry.enabled ? 'is-on' : ''}`}>
                <span className="minigame-list__icon emoji" aria-hidden="true">{game.icon}</span>
                <div className="minigame-list__text">
                  <Toggle id={`mg-${game.id}`} label={game.name} description={`${game.instructions}${customFor(game.id) ? ` · ${customFor(game.id)} свои` : ''}`} checked={entry.enabled} onChange={(enabled) => setGame(game.id, { enabled })} />
                  {entry.enabled && <NumberStepper label="Време" value={entry.durationSec} min={5} max={300} step={5} suffix=" сек." onChange={(durationSec) => setGame(game.id, { durationSec })} />}
                </div>
              </div>
            )
          })}
        </div>
        <ConfigErrors errors={errors.filter((e) => e.field === 'games')} />
      </ConfigSection>
      <ConfigSection title="Точки">
        <div className="config-grid">
          <NumberStepper label="За изпълнителя" value={config.pointsWin} min={0} max={10} onChange={(pointsWin) => onChange({ pointsWin })} />
          <NumberStepper label="За познал" value={config.pointsGuesser} min={0} max={10} onChange={(pointsGuesser) => onChange({ pointsGuesser })} />
        </div>
      </ConfigSection>
      <ContentSourcePanel config={config} onChange={onChange} kinds={kindsForModule('miniGames')} errors={errors} />
    </>
  )
}

export const CONFIG_PANELS = {
  wheel: WheelPanel,
  challenges: ChallengesPanel,
  whisper: WhisperPanel,
  gifts: GiftsPanel,
  luckCards: LuckCardsPanel,
  effects: EffectsPanel,
  missions: MissionsPanel,
  drinking: DrinkingPanel,
  miniGames: MiniGamesPanel,
}

