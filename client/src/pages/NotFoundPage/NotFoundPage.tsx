import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { Routes } from '@/routes'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-6 p-4">
      <Typography variant="headline" className="text-6xl font-heading font-bold text-primary">
        404
      </Typography>
      <Typography variant="title" className="text-center">
        Página no encontrada
      </Typography>
      <Typography variant="body" className="text-center text-muted-foreground">
        La ruta que intentaste acceder no existe.
      </Typography>
      <Button
        variant="primary"
        size="lg"
        onClick={() => navigate(Routes.AUTH)}
        animate={false}
      >
        Volver al inicio
      </Button>
    </div>
  )
}
