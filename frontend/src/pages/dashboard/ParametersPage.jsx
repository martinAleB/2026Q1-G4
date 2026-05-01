import { AlertCircle, BadgeCheck, CircleHelp } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const policy = {
  maxCreditSituation: '2',
  maxDebtEntities: '3',
  maxExternalDebt: '350000',
  cleanHistoryMonths: '6',
}

const notes = [
  {
    title: 'Situacion crediticia maxima permitida',
    value: '<= 2',
    description: 'Umbral principal para habilitar evaluacion de ofertas.',
  },
  {
    title: 'Maximo de entidades con deuda',
    value: '3 entidades',
    description: 'Control de sobreendeudamiento distribuido.',
  },
  {
    title: 'Deuda total externa maxima',
    value: 'ARS 350.000',
    description: 'Limite de exclusion para cartera de alto riesgo.',
  },
  {
    title: 'Meses de historial limpio',
    value: '6 meses',
    description: 'Consistencia de comportamiento crediticio.',
  },
]

export default function ParametersPage() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Parametros</h1>
        <p className="text-muted-foreground">
          Configuracion estatica de politica crediticia para segmentacion y reglas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-primary" />
            Elegibilidad crediticia
          </CardTitle>
          <CardDescription>
            Estos parametros aun son estaticos y se mostraran conectados al backend en la siguiente fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max-situation">Maxima situacion crediticia permitida</Label>
            <Input id="max-situation" value={policy.maxCreditSituation} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clean-history">Meses de historial limpio requeridos</Label>
            <Input id="clean-history" value={policy.cleanHistoryMonths} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-entities">Maximo de entidades con deuda</Label>
            <Input id="max-entities" value={policy.maxDebtEntities} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-debt">Maxima deuda total externa</Label>
            <Input id="max-debt" value={policy.maxExternalDebt} readOnly />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-4xl border bg-card p-6">
        <h2 className="mb-5 text-xl font-semibold">Resumen de politica actual</h2>
        <div className="space-y-4">
          {notes.map((item) => (
            <div key={item.title} className="rounded-3xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <CircleHelp className="size-3.5" />
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
