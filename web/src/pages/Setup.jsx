import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { $draft } from '@store/draft'
import { go } from '@store/router'
import { validateDraft, validatePlayers } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import StepConfigure from '@/components/setup/StepConfigure'
import StepModules from '@/components/setup/StepModules'
import StepOccasion from '@/components/setup/StepOccasion'
import StepPlayers from '@/components/setup/StepPlayers'
import StepReview from '@/components/setup/StepReview'
import WizardProgress, { WIZARD_STEPS } from '@/components/setup/WizardProgress'
import Button from '@/components/ui/Button'

const STEP_IDS = WIZARD_STEPS.map((s) => s.id)

export default function Setup({ params }) {
  const draft = useStore($draft)
  const requested = params?.step || 'occasion'
  const step = STEP_IDS.includes(requested) ? requested : 'occasion'
  const [showErrors, setShowErrors] = useState(false)

  // Without a draft only the first step makes sense (e.g. a deep link).
  useEffect(() => {
    if (!draft && step !== 'occasion') go('setup')
    if (params?.step && !STEP_IDS.includes(params.step)) go('setup')
  }, [draft, step, params?.step])

  useEffect(() => setShowErrors(false), [step])

  if (!draft && step !== 'occasion') return null

  const index = STEP_IDS.indexOf(step)
  const playersOk = draft ? validatePlayers(draft.players).length === 0 : false
  const validation = draft ? validateDraft(draft) : null
  const modulesOk = validation ? !validation.global.some((m) => m.includes('модул')) : false

  const reachable = (id) => {
    if (id === 'occasion') return true
    if (!draft) return false
    if (id === 'players') return true
    return playersOk
  }

  const goTo = (id) => (id === 'occasion' ? go('setup') : go('setupStep', { step: id }))

  const next = () => {
    if (step === 'players' && !playersOk) return setShowErrors(true)
    if (step === 'modules' && !modulesOk) return setShowErrors(true)
    goTo(STEP_IDS[index + 1])
  }

  return (
    <SiteLayout>
      <div className="setup container">
        <WizardProgress current={step} onStep={goTo} reachable={reachable} />
        {step === 'occasion' && <StepOccasion />}
        {step === 'players' && <StepPlayers showErrors={showErrors} />}
        {step === 'modules' && <StepModules showErrors={showErrors} global={validation?.global.filter((m) => m.includes('модул')) || []} />}
        {step === 'configure' && <StepConfigure />}
        {step === 'review' && <StepReview />}

        {step !== 'occasion' && step !== 'review' && (
          <div className="setup-nav">
            <Button variant="ghost" icon="arrow_back" onClick={() => goTo(STEP_IDS[index - 1])}>Назад</Button>
            <Button size="lg" iconEnd="arrow_forward" onClick={next}>
              {step === 'configure' ? 'Към прегледа' : 'Напред'}
            </Button>
          </div>
        )}
        {step === 'review' && (
          <div className="setup-nav">
            <Button variant="ghost" icon="arrow_back" onClick={() => goTo('configure')}>Назад</Button>
          </div>
        )}
      </div>
    </SiteLayout>
  )
}
