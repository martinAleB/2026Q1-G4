import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-4xl border bg-card p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-bold">Pagina no encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          El enlace que buscaste no existe en esta version del dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/">Ir al inicio</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/products">Ir al dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
