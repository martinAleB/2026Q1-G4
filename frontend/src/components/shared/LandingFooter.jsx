import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <span className="text-2xl font-bold">presti</span>
            <p className="mt-2 text-sm text-muted-foreground">
              Decision crediticia, productos y cartera en una sola plataforma para fintechs.
            </p>
          </div>

          <div>
            <h4 className="font-semibold">Producto</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="transition-colors hover:text-foreground">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-foreground">
                  Precios
                </a>
              </li>
              <li>
                <Link to="/create-account" className="transition-colors hover:text-foreground">
                  Comenzar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Empresa</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#about" className="transition-colors hover:text-foreground">
                  Nosotros
                </a>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Ingresar
                </Link>
              </li>
              <li>
                <a href="mailto:hola@presti.ai" className="transition-colors hover:text-foreground">
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Recursos</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Documentacion
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Politica de privacidad
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Terminos de servicio
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">(c) 2026 presti. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              LinkedIn
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
