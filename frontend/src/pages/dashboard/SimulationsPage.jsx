import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SimulationsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Simulador</h2>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Consultar Score Crediticio</CardTitle>
          <CardDescription>
            Ingrese el CUIT o CUIL para consultar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT / CUIL</Label>
              <Input
                id="cuit"
                placeholder="Ej: 20123456789"
                autoComplete="off"
              />
            </div>

            <Button type="button" className="w-full">
              <Search className="size-4 mr-2" />
              Simular
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}