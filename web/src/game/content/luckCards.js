// Luck card `effect` values are interpreted by the luckCards module.
const card = (id, title, body, effect, extra = {}) => ({
  id: `sys-lc-${id}`,
  title,
  body,
  effect,
  value: 0,
  rarity: 'common',
  category: 'Късмет',
  modes: ['any'],
  tags: [],
  ...extra,
})

export const SYSTEM_LUCK_CARDS = [
  card('spin', 'Завърти отново', 'Имаш още един ход веднага след този.', 'spin_again', { rarity: 'rare' }),
  card('immunity', 'Щит', 'Получаваш имунитет — можеш да пропуснеш едно бъдещо предизвикателство без наказание.', 'immunity', { rarity: 'rare' }),
  card('immunity2', 'Двоен щит', 'Получаваш 2 имунитета.', 'immunity', { rarity: 'epic', value: 2 }),
  card('give', 'Добро сърце', 'Подари 2 точки на играч по избор.', 'give_points', { value: 2 }),
  card('choose', 'Режисьор', 'Ти избираш кой играе следващ.', 'choose_next'),
  card('swap', 'Размяна', 'Размени подарък с друг играч.', 'exchange_gift', { rarity: 'rare' }),
  card('group-toast', 'Групово наздраве', 'Всички стават, вдигат чаши (или ръце) и казват тост за домакина.', 'group_event'),
  card('group-photo', 'Групова снимка', 'Всички заедно правят най-смешната възможна снимка.', 'group_event'),
  card('group-dance', 'Танц на всички', 'Пуснете песен — всички танцуват 30 секунди.', 'group_event'),
  card('group-hug', 'Групова прегръдка', 'Всички в средата за групова прегръдка!', 'group_event', { modes: ['family', 'birthday', 'christmas'] }),
  card('bonus1', 'Дребни пари', 'Получаваш 1 точка.', 'bonus_points', { value: 1 }),
  card('bonus3', 'Джакпот', 'Получаваш 3 точки!', 'bonus_points', { value: 3, rarity: 'epic' }),
  card('bonus5', 'Златно яйце', 'Получаваш 5 точки!', 'bonus_points', { value: 5, rarity: 'legendary' }),
  card('skip', 'Сънливец', 'Пропускаш следващия си ход.', 'skip_turn', { category: 'Наказание' }),
  card('steal', 'Крадец', 'Вземи 2 точки от играч по избор.', 'steal_points', { value: 2, rarity: 'rare' }),
  card('steal1', 'Джебчия', 'Вземи 1 точка от играч по избор.', 'steal_points', { value: 1 }),
  card('xmas-group', 'Коледна песен', 'Всички заедно пеят „Тиха нощ“ (поне първия куплет).', 'group_event', { modes: ['christmas'] }),
  card('bday-group', 'Наздраве за рожденика', 'Всички пеят „Честит рожден ден“ на рожденика.', 'group_event', { modes: ['birthday'] }),
]
