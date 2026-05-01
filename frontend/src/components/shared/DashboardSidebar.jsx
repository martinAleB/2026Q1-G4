import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  LogOut,
  Package,
  Sliders,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'

const navigation = [
  { name: 'Productos', href: '/dashboard/products', icon: Package },
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
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState)
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
              <p className="truncate text-sm font-medium">{user?.name ?? 'Equipo fintech'}</p>
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
          onClick={handleLogout}
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
    </aside>
  )
}
