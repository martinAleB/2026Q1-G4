import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <span className="text-2xl font-bold">presti</span>
            <p className="mt-2 text-sm text-muted-foreground">
              Motor de decision crediticia para equipos fintech.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegibilidad, oferta y cartera en un solo lugar.
            </p>
          </div>

          <div>
            <h4 className="font-semibold">Plataforma</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Simulaciones
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Cartera
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Productos
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Parámetros
                </Link>
              </li>
            </ul>
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
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Ingresar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Contacto</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:hola@presti.ai" className="transition-colors hover:text-foreground">
                  hola@presti.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">&copy; 2026 presti. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Acceder al dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
