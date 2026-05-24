import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  LogOut,
  Package,
  Search,
  Sliders,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const navigation = [
  { name: 'Productos', href: '/dashboard/products', icon: Package },
  { name: 'Simulador', href: '/dashboard/simulations', icon: Search },
  { name: 'Parametros', href: '/dashboard/parameters', icon: Sliders },
  { name: 'Cartera', href: '/dashboard/portfolio', icon: FolderKanban },
]

function getInitialCollapsedState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth < 1024
}

export function DashboardSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, fintechData, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const showLabels = !collapsed

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="h-18 border-b p-4 text-left transition-colors hover:bg-muted/60"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="size-5 text-primary" />
          </div>
          {showLabels ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fintechData?.fintech_name ?? user?.name ?? 'Equipo fintech'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? 'admin@fintech.com'}</p>
            </div>
          ) : null}
        </div>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center',
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="size-5 shrink-0" />
              {showLabels ? <span>{item.name}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <button
          type="button"
          onClick={() => setShowLogoutDialog(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Cerrar sesion' : undefined}
        >
          <LogOut className="size-5 shrink-0" />
          {showLabels ? <span>Cerrar sesion</span> : null}
        </button>
      </div>

      <AlertDialogRoot open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas salir? Tendrás que volver a iniciar sesión para acceder al dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </aside>
  )
}
