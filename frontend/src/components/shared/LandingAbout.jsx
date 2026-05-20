import { Award, Sparkles, Target } from 'lucide-react'

const values = [
  {
    title: 'Nuestra mision',
    text: 'Dar a las fintechs una herramienta simple para convertir datos crediticios en decisiones operables.',
    icon: Target,
  },
  {
    title: 'Nuestro enfoque',
    text: 'Separar politicas, productos y seguimiento para que cada decision sea entendible y ajustable.',
    icon: Award,
  },
  {
    title: 'Nuestra vision',
    text: 'Ser la capa de decision crediticia que acompana la operacion diaria de las fintechs.',
    icon: Sparkles,
  },
]

export function LandingAbout() {
  return (
    <section id="about" className="scroll-mt-16 bg-muted/50">
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-20 md:px-6 md:py-32 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
            Una capa operativa para decidir con mejor contexto
          </h2>
          <div className="space-y-6 text-lg text-muted-foreground">
            <p>
              presti ayuda a fintechs a ordenar el proceso de evaluacion crediticia en un solo lugar:
              clientes, productos, recomendaciones, politica y cartera.
            </p>
            <p>
              En vez de repartir decisiones entre planillas y reglas manuales, la plataforma concentra
              la logica comercial y de riesgo para que el equipo ajuste criterios con menos friccion.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {values.map((value) => {
            const Icon = value.icon

            return (
              <div key={value.title} className="flex gap-4 rounded-4xl border bg-card p-6">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="size-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{value.title}</h3>
                  <p className="mt-2 text-muted-foreground">{value.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
