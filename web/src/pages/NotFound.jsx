import SiteLayout from '@/layouts/SiteLayout'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export default function NotFound() {
  return (
    <SiteLayout>
      <div className="container page-pad">
        <EmptyState icon="🙈" title="Тази страница я няма" text="Може би колелото я е изпратило другаде." action={<Button href="/" icon="home">Към началото</Button>} />
      </div>
    </SiteLayout>
  )
}
