import {
  Activity,
  Database,
  FolderKanban,
  RefreshCcw,
  Sliders,
  TrendingUp,
} from 'lucide-react'

const features = [
  {
    icon: Database,
    title: 'Recomendaciones de productos',
    description:
      'Consulta perfiles y obten sugerencias alineadas al riesgo y a la oferta disponible de tu fintech.',
  },
  {
    icon: RefreshCcw,
    title: 'Configuracion simple',
    description:
      'Administra productos, limites y reglas de negocio desde una sola interfaz operacional.',
  },
  {
    icon: FolderKanban,
    title: 'Gestion de cartera',
    description:
      'Da seguimiento a clientes monitoreados y visualiza mejoras o deterioros en su situacion crediticia.',
  },
  {
    icon: Sliders,
    title: 'Politica configurable',
    description:
      'Define criterios de elegibilidad como situacion BCRA, deuda externa e historial limpio.',
  },
  {
    icon: Activity,
    title: 'Uso y operacion',
    description:
      'Consulta el uso diario y los principales indicadores de decision para tu equipo.',
  },
  {
    icon: TrendingUp,
    title: 'Vision unificada',
    description:
      'Combina clientes, productos y recomendaciones en un dashboard pensado para decision diaria.',
  },
]

export function LandingFeatures() {
  return (
    <section id="features" className="container mx-auto scroll-mt-16 px-4 py-20 md:px-6 md:py-32">
      <div className="mb-16 flex flex-col items-center text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          Todo lo necesario para operar con mas criterio
        </h2>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Una plataforma enfocada en elegibilidad, oferta y seguimiento para equipos fintech.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon

          return (
            <article
              key={feature.title}
              className="rounded-4xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="size-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
