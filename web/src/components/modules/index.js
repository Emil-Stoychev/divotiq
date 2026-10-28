// UI registry: module id -> { ConfigPanel, Screen }. The engine registry
// (src/game/modules) stays React-free; adding a module means registering its
// logic there and its UI here.

import { ChooseScreen, TurnStartScreen } from '@/components/play/CoreScreens'
import { ChallengeScreen, DrinkingScreen, EffectScreen, GiftScreen, LuckCardScreen, MiniGameScreen, MissionScreen, WhisperScreen } from '@/components/play/ModuleScreens'
import WheelScreen from '@/components/play/WheelScreen'
import { CONFIG_PANELS } from './configPanels'

const SCREENS = {
  wheel: WheelScreen,
  challenges: ChallengeScreen,
  whisper: WhisperScreen,
  gifts: GiftScreen,
  luckCards: LuckCardScreen,
  effects: EffectScreen,
  missions: MissionScreen,
  drinking: DrinkingScreen,
  miniGames: MiniGameScreen,
}

export function screenFor(activity) {
  if (activity.moduleId === 'core') return activity.kind === 'turnStart' ? TurnStartScreen : ChooseScreen
  return SCREENS[activity.moduleId] || null
}

export function configPanelFor(moduleId) {
  return CONFIG_PANELS[moduleId] || null
}
