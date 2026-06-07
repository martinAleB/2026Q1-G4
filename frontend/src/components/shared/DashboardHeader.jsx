import { useState, useEffect } from 'react'
import { Settings, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/store/AuthContext'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function DashboardHeader() {
  const { fintechData, refreshFintech } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [fintechName, setFintechName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync state when the dialog opens or when fintechData changes
  useEffect(() => {
    if (fintechData?.fintech_name) {
      setFintechName(fintechData.fintech_name)
    }
  }, [fintechData, isOpen])

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')

    const tokens = JSON.parse(window.localStorage.getItem('cloud-dashboard-tokens') || '{}')
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_GATEWAY_CALLBACK_URL.replace('/callback', '')}/fintech`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.idToken}`
        },
        body: JSON.stringify({ fintech_name: fintechName })
      })

      if (response.ok) {
        await refreshFintech()
        setIsOpen(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Error al actualizar el nombre de la fintech')
      }
    } catch (err) {
      setError('Error de red al intentar guardar los datos')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <header className="h-18 border-b bg-card px-6">
      <div className="relative flex h-full items-center justify-center">
        <span className="text-2xl font-bold">presti</span>
        
        <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
          <button
            onClick={() => setIsOpen(true)}
            className="absolute right-0 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Configuración"
          >
            <Settings className="size-5" />
          </button>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Configuración de la Cuenta</DialogTitle>
              <DialogDescription>
                Modifica el nombre de tu empresa fintech a continuación.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="popup-fintech-name">Nombre de la Fintech</Label>
                <Input
                  id="popup-fintech-name"
                  type="text"
                  placeholder="Ej: Presti Pagos SA"
                  value={fintechName}
                  onChange={(e) => setFintechName(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSaving}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || !fintechName.trim()}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </DialogRoot>
      </div>
    </header>
  )
}

