import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { Routes } from '@/routes'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { i18nText } = useI18n()

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4">
      <Typography variant="headline" className="text-6xl font-heading font-bold text-primary">
        404
      </Typography>
      <Typography variant="title" className="text-center">
        {i18nText('notFoundTitle')}
      </Typography>
      <Typography variant="body" className="text-center text-muted-foreground">
        {i18nText('notFoundMessage')}
      </Typography>
      <Button
        variant="primary"
        size="lg"
        onClick={() => navigate(Routes.AUTH)}
      >
        {i18nText('notFoundGoHome')}
      </Button>
    </div>
  )
}
