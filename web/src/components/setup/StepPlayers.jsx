import { useStore } from '@nanostores/react'
import { useRef, useState } from 'react'
import { playerListsApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { $draft, updateDraft } from '@store/draft'
import { toastError, toastSuccess } from '@store/toasts'
import { AVATARS } from '@/game/avatars'
import { MAX_PLAYER_NAME, MAX_PLAYERS, MIN_PLAYERS, validatePlayers } from '@/game'
import { createId } from '@/game/engine/ids'
import { useAsync } from '@/hooks/useAsync'
import AvatarPicker from '@/components/ui/AvatarPicker'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { TextInput } from '@/components/ui/Field'

function nextAvatar(players) {
  const used = new Set(players.map((p) => p.avatar))
  return AVATARS.find((a) => !used.has(a)) || AVATARS[players.length % AVATARS.length]
}

function PlayerLists({ players, onLoad }) {
  const { data, reload } = useAsync(() => playerListsApi.mine(), [])
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const lists = data?.items || []

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await playerListsApi.create({ name: name.trim() || 'Моята компания', players: players.map(({ name: n, avatar }) => ({ name: n, avatar })) })
      toastSuccess('Списъкът е запазен')
      setOpen(false)
      setName('')
      reload()
    } catch (err) {
      toastError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await playerListsApi.remove(id)
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }

  return (
    <div className="player-lists">
      <div className="player-lists__head">
        <h3>Запазени компании</h3>
        <Button variant="soft" size="sm" icon="save" disabled={players.length < 2} onClick={() => setOpen(true)}>Запази тези играчи</Button>
      </div>
      {lists.length ? (
        <ul className="player-lists__list">
          {lists.map((list) => (
            <li key={list.id}>
              <button type="button" className="player-lists__load" onClick={() => onLoad(list.players)}>
                <span className="player-lists__avatars">{list.players.slice(0, 5).map((p, i) => <span key={i} className="emoji">{p.avatar}</span>)}</span>
                <span>
                  <strong>{list.name}</strong>
                  <small>{list.players.length} играчи</small>
                </span>
              </button>
              <Button variant="ghost" size="sm" icon="delete" aria-label={`Изтрий ${list.name}`} onClick={() => remove(list.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Запази компанията си, за да не пишеш имената всеки път.</p>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Запази компанията" size="sm">
        <form onSubmit={save} className="stack">
          <TextInput label="Име на списъка" value={name} maxLength={60} placeholder="напр. Колегите" onChange={(e) => setName(e.target.value)} />
          <Button type="submit" loading={saving} icon="save">Запази</Button>
        </form>
      </Modal>
    </div>
  )
}

export default function StepPlayers({ showErrors }) {
  const draft = useStore($draft)
  const me = useStore($me)
  const [name, setName] = useState('')
  const [picking, setPicking] = useState(null)
  const inputRef = useRef(null)
  const players = draft.players
  const errors = validatePlayers(players)
  const duplicate = players.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())

  const setPlayers = (mutate) => updateDraft((d) => mutate(d.players))

  const add = (e) => {
    e?.preventDefault()
    const clean = name.trim().slice(0, MAX_PLAYER_NAME)
    if (!clean || duplicate || players.length >= MAX_PLAYERS) return
    setPlayers((list) => list.push({ id: createId('p'), name: clean, avatar: nextAvatar(list) }))
    setName('')
    inputRef.current?.focus()
  }

  const loadList = (list) =>
    updateDraft((d) => {
      d.players = list.slice(0, MAX_PLAYERS).map((p) => ({ id: createId('p'), name: p.name, avatar: p.avatar || '🙂' }))
    })

  const move = (index, delta) =>
    setPlayers((list) => {
      const [item] = list.splice(index, 1)
      list.splice(index + delta, 0, item)
    })

  return (
    <div className="setup-step">
      <header className="setup-step__head">
        <h1 className="setup-step__title">Кой играе?</h1>
        <p className="text-muted">
          Между {MIN_PLAYERS} и {MAX_PLAYERS} играчи. Всички играят на това устройство — подавайте си го, когато е ваш ред.
        </p>
      </header>

      <div className="players-layout">
        <div className="players-card card">
          <form className="player-add" onSubmit={add}>
            <input
              ref={inputRef}
              className="input input--lg"
              placeholder={players.length ? 'Име на следващия играч' : 'Име на първия играч'}
              value={name}
              maxLength={MAX_PLAYER_NAME}
              onChange={(e) => setName(e.target.value)}
              aria-label="Име на играч"
              disabled={players.length >= MAX_PLAYERS}
              autoFocus
            />
            <Button type="submit" size="lg" icon="person_add" disabled={!name.trim() || duplicate || players.length >= MAX_PLAYERS}>
              Добави
            </Button>
          </form>
          {duplicate && name.trim() && <p className="field__error">Вече има играч с това име</p>}

          {players.length ? (
            <ol className="player-list">
              {players.map((player, index) => (
                <li key={player.id} className="player-list__item">
                  <span className="player-list__num">{index + 1}</span>
                  <button type="button" className="player-list__avatar" onClick={() => setPicking(player.id)} aria-label={`Смени аватара на ${player.name}`}>
                    <span className="emoji">{player.avatar}</span>
                  </button>
                  <input
                    className="input player-list__name"
                    value={player.name}
                    maxLength={MAX_PLAYER_NAME}
                    onChange={(e) => setPlayers((list) => { list[index].name = e.target.value })}
                    aria-label={`Име на играч ${index + 1}`}
                  />
                  <div className="player-list__tools">
                    <Button variant="ghost" size="sm" icon="arrow_upward" aria-label="Нагоре" disabled={index === 0} onClick={() => move(index, -1)} />
                    <Button variant="ghost" size="sm" icon="arrow_downward" aria-label="Надолу" disabled={index === players.length - 1} onClick={() => move(index, 1)} />
                    <Button variant="ghost" size="sm" icon="close" aria-label={`Премахни ${player.name}`} onClick={() => setPlayers((list) => { list.splice(index, 1) })} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="player-list__empty">
              <span className="emoji" aria-hidden="true">👯</span>
              <p>Добави поне двама играчи. Редът тук е редът на ходовете.</p>
            </div>
          )}

          <div className="players-card__footer">
            <span className="text-muted">{players.length} / {MAX_PLAYERS} играчи</span>
            {players.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                icon="shuffle"
                onClick={() =>
                  setPlayers((list) => {
                    for (let i = list.length - 1; i > 0; i -= 1) {
                      const j = Math.floor(Math.random() * (i + 1))
                      ;[list[i], list[j]] = [list[j], list[i]]
                    }
                  })
                }
              >
                Разбъркай реда
              </Button>
            )}
          </div>
          {showErrors && errors.length > 0 && (
            <ul className="config-errors" role="alert">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
        </div>

        <aside className="players-aside">
          {me ? (
            <PlayerLists players={players} onLoad={loadList} />
          ) : (
            <div className="card players-aside__guest">
              <span className="emoji" aria-hidden="true">💾</span>
              <p>С профил можеш да запазиш компанията си и да я зареждаш с едно натискане.</p>
              <Button variant="soft" size="sm" href="/register">Създай профил</Button>
            </div>
          )}
        </aside>
      </div>

      <Modal open={Boolean(picking)} onClose={() => setPicking(null)} title="Избери аватар" size="sm">
        <AvatarPicker
          value={players.find((p) => p.id === picking)?.avatar}
          onChange={(avatar) => {
            setPlayers((list) => {
              const player = list.find((p) => p.id === picking)
              if (player) player.avatar = avatar
            })
            setPicking(null)
          }}
        />
      </Modal>
    </div>
  )
}
