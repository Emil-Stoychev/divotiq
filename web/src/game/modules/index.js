// Importing this file registers every built-in module. To add a module, create
// a file that calls registerModule() and import it here.
import './wheel'
import './challenges'
import './whisper'
import './gifts'
import './luckCards'
import './effects'
import './missions'
import './drinking'
import './miniGames'

export { getModule, listModules, hasModule } from './registry'
export { availableSegments, segmentGeometry, WHEEL_TARGETS, defaultSegments } from './wheel'
export { LUCK_EFFECTS } from './luckCards'
export { FAIL_ACTIONS, SUCCESS_REWARDS } from './challenges'
export { EXCHANGE_RULES, inventoryOf } from './gifts'
export { listMiniGames, getMiniGame, registerMiniGame } from './miniGames'
