import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  CheckCircle,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const stats = {
  totalClients: 1240,
  improved: 318,
  deteriorated: 147,
}

const changes = [
  {
    cuil: '20-32765412-8',
    previousSituation: 'Situacion 3',
    currentSituation: 'Situacion 2',
    type: 'mejora',
    label: '-1',
    detectedAt: 'Hace 2 horas',
  },
  {
    cuil: '27-28567109-3',
    previousSituation: 'Situacion 2',
    currentSituation: 'Situacion 4',
    type: 'deterioro',
    label: '+2',
    detectedAt: 'Ayer',
  },
  {
    cuil: '20-30123456-1',
    previousSituation: 'Situacion 1',
    currentSituation: 'Situacion 1',
    type: 'sin-cambios',
    label: 'Sin cambios',
    detectedAt: 'Hace 3 dias',
  },
]

function badgeClasses(type) {
  if (type === 'mejora') {
    return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
  }

  if (type === 'deterioro') {
    return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
  }

  return 'bg-muted text-muted-foreground'
}

function changeIcon(type) {
  if (type === 'mejora') {
    return <ArrowUpCircle className="size-3.5" />
  }

  if (type === 'deterioro') {
    return <ArrowDownCircle className="size-3.5" />
  }

  return <CheckCircle className="size-3.5" />
}

export default function PortfolioPage() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Cartera</h1>
          <p className="text-muted-foreground">
            Seguimiento estatico de cambios en la situacion crediticia de clientes monitoreados.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          <span>Actualizado: hoy 09:30</span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes monitoreados</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">Base total registrada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mejoras detectadas</CardTitle>
            <ArrowUpCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{stats.improved}</div>
            <p className="text-xs text-muted-foreground">25.6% del total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deterioros detectados</CardTitle>
            <ArrowDownCircle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{stats.deteriorated}</div>
            <p className="text-xs text-muted-foreground">11.8% del total</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">Filtrar por:</span>
        <Button size="sm">Todos</Button>
        <Button size="sm" variant="outline">
          Mejoras
        </Button>
        <Button size="sm" variant="outline">
          Deterioros
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cambios en situacion crediticia</CardTitle>
          <CardDescription>Eventos detectados para cartera consultada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {changes.map((client) => (
              <article
                key={client.cuil}
                className="rounded-3xl border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-base font-semibold">CUIL: {client.cuil}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(
                          client.type,
                        )}`}
                      >
                        {changeIcon(client.type)}
                        {client.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Situacion anterior</p>
                        <p className="font-medium">{client.previousSituation}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Situacion nueva</p>
                        <p className="font-medium">{client.currentSituation}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Detectado</p>
                        <p className="font-medium">{client.detectedAt}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
