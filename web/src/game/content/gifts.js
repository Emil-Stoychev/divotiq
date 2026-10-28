// Default virtual rewards used when the host does not define physical gifts.
const g = (id, name, description, rarity = 'common', extra = {}) => ({
  id: `sys-gf-${id}`,
  name,
  description,
  rarity,
  type: 'virtual',
  mystery: false,
  ...extra,
})

export const SYSTEM_GIFTS = [
  g('crown', 'Корона на вечерта', 'Носителят може веднъж да даде заповед на всички.', 'legendary'),
  g('cup', 'Златна чаша', 'Само ти пиеш от „златната чаша“.', 'epic'),
  g('dj', 'DJ пулт', 'Избираш следващите 3 песни.', 'rare'),
  g('veto', 'Право на вето', 'Можеш да откажеш едно предизвикателство.', 'rare'),
  g('throne', 'Тронът', 'Най-удобното място е твое до края на вечерта.', 'epic'),
  g('remote', 'Дистанционното', 'Ти решаваш какво гледаме след играта.', 'common'),
  g('snack', 'Първи на мезето', 'Взимаш първи от следващата чиния.', 'common'),
  g('photo', 'Главен фотограф', 'Ти правиш официалната снимка на вечерта.', 'common'),
  g('hug', 'Ваучер за прегръдка', 'Използвай когато поискаш.', 'common'),
  g('mystery', 'Мистериозна кутия', 'Никой не знае какво има вътре…', 'rare', { mystery: true }),
  g('star', 'Звезда на вечерта', 'Официално признание за най-забавен.', 'epic'),
  g('dance', 'Първи танц', 'Избираш с кого да танцуваш първия бавен танц.', 'common'),
]
