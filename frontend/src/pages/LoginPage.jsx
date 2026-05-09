import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/store/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard/products" replace />
  }

  const handleLogin = (event) => {
    event.preventDefault()
    login()
  }

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

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Bienvenido de nuevo</h1>
            <p className="text-muted-foreground">Ingresa con tu cuenta de Cognito para continuar</p>
          </div>

          <div className="flex flex-col gap-4">
            <Button onClick={handleLogin} className="w-full" size="lg">
              Iniciar Sesión Seguro
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
