import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Brain, RefreshCcw } from 'lucide-react'


import { Button } from '@/components/ui/button'

const highlights = [
  {
    title: 'Recomendaciones accionables',
    description:
      'Genera sugerencias de productos a partir del perfil del cliente y la oferta configurada.',
    icon: Brain,
  },
  {
    title: 'Analitica operativa',
    description:
      'Sigue parametros, cartera y productos activos desde un solo dashboard para el equipo de riesgo.',
    icon: BarChart3,
  },
  {
    title: 'Politica y cartera',
    description:
      'Ajusta reglas crediticias y revisa cambios relevantes en la cartera de clientes monitoreados.',
    icon: RefreshCcw,
  },
]

export function LandingHero() {
  return (
    <section className="container mx-auto border-b px-4 py-20 md:px-6 md:pb-32 md:pt-14">
      <div className="flex flex-col items-center space-y-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
          <Brain className="size-4" />
          <span>Motor de decision crediticia para fintechs</span>
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Evalua perfiles,
          <span className="text-muted-foreground"> configura politicas y ofrece mejores productos</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          presti centraliza analiticas, reglas de elegibilidad, configuracion de productos y seguimiento
          de cartera para tomar decisiones crediticias con mas contexto y menos friccion.
        </p>

        <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row">
          <Button size="lg" className="gap-2" asChild>
            <Link to="/login">
              Ingresar
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-8 pt-12 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon

            return (
              <div key={item.title} className="rounded-4xl border bg-card p-6">
                <div className="mb-3 flex items-center justify-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-center text-sm text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
