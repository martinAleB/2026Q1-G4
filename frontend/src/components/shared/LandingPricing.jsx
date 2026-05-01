import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'

const plans = [
  {
    name: 'Pro',
    price: 'USD 299',
    description: 'Para fintechs chicas o equipos que validan producto con volumen acotado.',
    features: [
      'Hasta 5.000 evaluaciones por mes',
      'Suscripcion mensual fija',
      'Acceso a funciones principales',
      'Cargo variable por excedente',
    ],
    cta: 'Crear cuenta',
    link: '/create-account',
  },
  {
    name: 'Business',
    price: 'USD 1.090',
    description: 'Para equipos en crecimiento con mayor volumen operativo.',
    features: [
      'Mayor volumen incluido',
      'Costo marginal menor por consulta',
      'Mas profundidad de analitica',
      'Pensado para escalar operacion',
    ],
    cta: 'Crear cuenta',
    link: '/create-account',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Desde USD 3.000',
    description: 'Para clientes de gran escala o integraciones criticas.',
    features: [
      'Altos volumenes incluidos',
      'Condiciones comerciales personalizadas',
      'Soporte dedicado',
      'SLA segun necesidad',
    ],
    cta: 'Contactar ventas',
    link: '/create-account',
  },
]

export function LandingPricing() {
  return (
    <section id="pricing" className="container mx-auto scroll-mt-16 px-4 py-20 md:px-6 md:py-32">
      <div className="mb-16 flex flex-col items-center text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          Pricing alineado al valor de tu operacion
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          La propuesta combina suscripcion mensual por acceso a infraestructura de decision y un
          componente variable segun uso.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative flex flex-col rounded-4xl border bg-card p-8 ${
              plan.popular ? 'ring-2 ring-primary shadow-md' : ''
            }`}
          >
            {plan.popular ? (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
                Mas popular
              </div>
            ) : null}

            <div className="mb-8 space-y-4">
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.name !== 'Enterprise' ? <span className="text-muted-foreground">/mes</span> : null}
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full" size="lg" variant={plan.popular ? 'default' : 'outline'} asChild>
              <Link to={plan.link}>{plan.cta}</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
