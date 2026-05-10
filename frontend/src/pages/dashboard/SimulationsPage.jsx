import { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SimulationsPage() {
  const [cuit, setCuit] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [score, setScore] = useState(null)
  const [statusText, setStatusText] = useState('')
  
  const pollingRef = useRef(null)

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const handleCuitChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11)
    setCuit(value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cuit.length !== 11) {
      setError('El CUIT/CUIL debe tener 11 dígitos')
      return
    }

    setIsLoading(true)
    setError(null)
    setScore(null)
    setStatusText('Simulando...')
    stopPolling()

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      
      const postResponse = await fetch(`${apiUrl}/simulaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit }),
      })

      if (!postResponse.ok) {
        throw new Error('Error al iniciar la simulación')
      }

      const postData = await postResponse.json()
      const taskId = postData.task_id

      pollingRef.current = setInterval(async () => {
        try {
          const getResponse = await fetch(`${apiUrl}/simulaciones/${taskId}`)
          
          if (!getResponse.ok) {
            throw new Error('Error al consultar el estado de la simulación')
          }

          const getData = await getResponse.json()

          if (getData.status === 'COMPLETED') {
            stopPolling()
            setScore(getData.score)
            setIsLoading(false)
            setStatusText('')
          } else if (getData.status === 'FAILED') {
            stopPolling()
            setError(getData.error_msg || 'La simulación falló')
            setIsLoading(false)
            setStatusText('')
          } else {
            setStatusText('Simulando...')
          }
        } catch (pollError) {
          stopPolling()
          setError(pollError.message)
          setIsLoading(false)
          setStatusText('')
        }
      }, 2000)

    } catch (err) {
      setError(err.message)
      setIsLoading(false)
      setStatusText('')
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Simulador</h2>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Consultar Score Crediticio</CardTitle>
          <CardDescription>
            Ingrese el CUIT o CUIL (sin guiones ni puntos) para evaluar el producto disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT / CUIL</Label>
              <div className="flex gap-2">
                <Input
                  id="cuit"
                  placeholder="Ej: 20123456789"
                  value={cuit}
                  onChange={handleCuitChange}
                  disabled={isLoading}
                  autoComplete="off"
                />
                <Button type="submit" disabled={isLoading || cuit.length !== 11}>
                  <Search className="size-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                <Loader2 className="size-4 animate-spin" />
                {statusText}
              </div>
            )}

            {score !== null && !isLoading && (
              <div className="mt-6 rounded-xl border bg-muted/50 p-6 text-center">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Score Obtenido
                </h3>
                <div className="text-5xl font-bold text-primary">
                  {score}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
