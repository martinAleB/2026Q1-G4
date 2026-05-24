import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function scrollToSection(id) {
  const element = document.getElementById(id)

  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <span className="text-2xl font-bold tracking-tight">presti</span>

        <nav className="hidden items-center gap-8 md:flex">
          {/* <button
            type="button"
            onClick={() => scrollToSection('features')}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Funcionalidades
          </button> */}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
