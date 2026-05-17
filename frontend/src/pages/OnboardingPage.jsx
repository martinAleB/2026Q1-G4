import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/store/AuthContext'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, logout, refreshFintech } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const tokens = JSON.parse(window.localStorage.getItem('cloud-dashboard-tokens') || '{}')
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_CALLBACK_URL.replace('/callback', '')}/fintech`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.idToken}`
        },
        body: JSON.stringify({ fintech_name: companyName })
      })

      if (response.ok) {
        await refreshFintech()
        navigate('/dashboard')
      } else {
        const data = await response.json()
        setError(data.error || 'Error al guardar la fintech')
      }
    } catch (err) {
      setError('Error de red al intentar guardar los datos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md mb-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">¡Bienvenido a presti!</CardTitle>
          <CardDescription>
            Para comenzar, necesitamos saber el nombre de tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="company-name">Nombre de la Fintech</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Ej: Presti Pagos SA"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading || !companyName.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Completar Registro'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
            <LogOut className="mr-2 size-4" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
      
      <p className="mt-12 text-center text-sm text-muted-foreground">
        Conectado como <span className="font-medium text-foreground">{user?.email}</span>
      </p>
    </div>
  )
}
