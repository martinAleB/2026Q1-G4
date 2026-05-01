import { Package, Percent, Wallet } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const products = [
  {
    name: 'Prestamo Personal Plus',
    type: 'Prestamo',
    range: 'ARS 120.000 - ARS 2.400.000',
    rate: 'Tasa anual 38% - 62%',
    installments: '12 a 48 cuotas',
  },
  {
    name: 'Microprestamo Express',
    type: 'Microprestamo',
    range: 'ARS 25.000 - ARS 180.000',
    rate: 'Tasa anual 45% - 85%',
    installments: '1 a 6 cuotas',
  },
  {
    name: 'Tarjeta Capital Pyme',
    type: 'Tarjeta',
    range: 'Limite ARS 500.000 - ARS 4.000.000',
    rate: 'Interes anual 40% - 76%',
    installments: 'Hasta 12 cuotas',
  },
]

const metrics = [
  {
    title: 'Productos activos',
    value: '3',
    description: 'Oferta vigente para recomendacion',
    icon: Package,
  },
  {
    title: 'Tasa promedio',
    value: '56.2%',
    description: 'Promedio ponderado de configuraciones',
    icon: Percent,
  },
  {
    title: 'Ticket promedio',
    value: 'ARS 740.000',
    description: 'Rango medio entre productos activos',
    icon: Wallet,
  },
]

export default function ProductsPage() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Productos de la fintech</h1>
        <p className="text-muted-foreground">
          Vista estatica de la oferta configurada. Luego se conectara al backend del motor.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.name}>
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.type}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Monto o limite</p>
                <p className="font-medium">{product.range}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Costo financiero</p>
                <p className="font-medium">{product.rate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Plazo</p>
                <p className="font-medium">{product.installments}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
