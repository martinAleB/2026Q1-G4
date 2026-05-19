import { useState, useEffect } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  CheckCircle,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const API = import.meta.env.VITE_SIMULATIONS_API_URL
const TOKENS_KEY = 'cloud-dashboard-tokens'

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

function badgeClasses(type) {
  if (type === 'up') return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
  if (type === 'down') return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
  return 'bg-muted text-muted-foreground'
}

function changeIcon(type) {
  if (type === 'up') return <ArrowUpCircle className="size-3.5" />
  if (type === 'down') return <ArrowDownCircle className="size-3.5" />
  return <CheckCircle className="size-3.5" />
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'up', 'down'

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const res = await fetch(`${API}/portfolio`, { headers: authHeaders() })
        if (res.ok) {
          const data = await res.json()
          setPortfolio(data)
        }
      } catch (error) {
        console.error("Error fetching portfolio:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPortfolio()
  }, [])

  const improvedCount = portfolio.filter(item => item.trend === 'up').length
  const deterioratedCount = portfolio.filter(item => item.trend === 'down').length
  const totalCount = portfolio.length

  const filteredPortfolio = portfolio.filter(item => {
    if (filter === 'all') return true;
    return item.trend === filter;
  });

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Cartera</h1>
          <p className="text-muted-foreground">
            Seguimiento estático de cambios en la situación crediticia de clientes monitoreados.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          <span>Actualizado: hoy</span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes monitoreados</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">Base total registrada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mejoras detectadas</CardTitle>
            <ArrowUpCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{improvedCount}</div>
            <p className="text-xs text-muted-foreground">Oportunidades de negocio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deterioros detectados</CardTitle>
            <ArrowDownCircle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{deterioratedCount}</div>
            <p className="text-xs text-muted-foreground">Riesgos en cartera</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">Filtrar por:</span>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Todos</Button>
        <Button size="sm" variant={filter === 'up' ? 'default' : 'outline'} onClick={() => setFilter('up')}>
          Mejoras
        </Button>
        <Button size="sm" variant={filter === 'down' ? 'default' : 'outline'} onClick={() => setFilter('down')}>
          Deterioros
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cambios en situación crediticia</CardTitle>
          <CardDescription>Eventos detectados para cartera consultada</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center p-8 text-sm text-muted-foreground">Cargando cartera...</div>
          ) : filteredPortfolio.length === 0 ? (
             <div className="flex justify-center p-8 text-sm text-muted-foreground">No hay clientes monitoreados.</div>
          ) : (
            <div className="space-y-4">
              {filteredPortfolio.map((client) => {
                let label = client.trend === 'up' ? 'Mejora' : client.trend === 'down' ? 'Deterioro' : 'Sin cambios';
                return (
                  <article
                    key={client.cuit}
                    className="rounded-3xl border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-base font-semibold">CUIT: {client.cuit}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(
                              client.trend,
                            )}`}
                          >
                            {changeIcon(client.trend)}
                            {label}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Situación anterior</p>
                            <p className="font-medium">{client.previous_status || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Situación actual</p>
                            <p className="font-medium">{client.current_status}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Monitoreado desde</p>
                            <p className="font-medium">{client.tracked_at ? new Date(client.tracked_at).toLocaleDateString('es-AR') : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
