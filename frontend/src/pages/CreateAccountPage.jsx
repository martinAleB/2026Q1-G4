import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/store/AuthContext'

export default function CreateAccountPage() {
  const { signup } = useAuth()

  useEffect(() => {
    // Redirigir automáticamente a Cognito al cargar la página
    signup()
  }, [signup])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Volver al inicio</span>
          </Link>
          <span className="text-2xl font-bold">presti</span>
          <div className="w-[120px]" />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <Loader2 className="mb-4 size-8 animate-spin text-primary" />
        <h1 className="text-2xl font-semibold">Redirigiendo al registro seguro...</h1>
        <p className="mt-2 text-muted-foreground">
          Estamos preparándolo todo para que crees tu cuenta en presti.
        </p>
        <Button onClick={signup} variant="outline" className="mt-6">
          Si no eres redirigido, haz clic aquí
        </Button>
      </main>
    </div>
  )
}
