import { useState, useEffect, useCallback } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  CheckCircle,
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [items, setItems] = useState([])
  const [nextToken, setNextToken] = useState(null)
  const [tokenStack, setTokenStack] = useState([]) // Para poder volver atrás
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('') // Nueva variable para saber si hay una búsqueda activa
  const [currentPage, setCurrentPage] = useState(1)

  const fetchPortfolio = useCallback(async (token = null, query = '', direction = 'next') => {
    setIsLoading(true)
    try {
      let url = `${API}/portfolio?limit=20`
      if (token) url += `&next_token=${token}`
      if (query) url += `&cuit=${encodeURIComponent(query)}`

      const res = await fetch(url, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setNextToken(data.next_token)
        
        if (direction === 'next' && token) {
          setTokenStack(prev => [...prev, token])
          setCurrentPage(c => c + 1)
        } else if (direction === 'prev') {
          setTokenStack(prev => prev.slice(0, -1))
          setCurrentPage(c => c - 1)
        } else if (!token) {
          // Reset al buscar o carga inicial
          setTokenStack([])
          setCurrentPage(1)
        }
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error)
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  const handleSearch = (e) => {
    e.preventDefault()
    setIsSearching(true)
    setActiveSearch(searchQuery) // Marcamos la búsqueda como activa solo al enviar el formulario
    setItems([])
    fetchPortfolio(null, searchQuery)
  }

  const handleNext = () => {
    if (nextToken && !isLoading) {
      fetchPortfolio(nextToken, activeSearch, 'next')
    }
  }

  const handlePrev = () => {
    if (tokenStack.length > 0 && !isLoading) {
      const prevToken = tokenStack.length > 1 ? tokenStack[tokenStack.length - 2] : null
      fetchPortfolio(prevToken, activeSearch, 'prev')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Cartera</h1>
          <p className="text-muted-foreground">
            Seguimiento estático de cambios en la situación crediticia de CUIT/CUILs monitoreados.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          <span>Actualizado: hoy</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Buscar por CUIT/CUIL exacto..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, ''); // Solo números
                setSearchQuery(val);
              }}
            />
          </div>
          <Button type="submit" disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
          {(searchQuery || activeSearch) && (
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => { 
                setSearchQuery(''); 
                setActiveSearch(''); 
                fetchPortfolio(null, ''); 
              }}
            >
              Limpiar
            </Button>
          )}
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cambios en situación crediticia</CardTitle>
          <CardDescription>Eventos detectados para cartera de CUIT/CUILs consultados</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !isLoading ? (
             <div className="flex justify-center p-8 text-sm text-muted-foreground">
               No se encontraron CUIT/CUILs monitoreados.
             </div>
          ) : (
            <div className="space-y-4">
              {items.map((client) => {
                let label = client.trend === 'up' ? 'Mejora' : client.trend === 'down' ? 'Deterioro' : 'Sin cambios';
                return (
                  <article
                    key={client.cuit}
                    className="rounded-3xl border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-base font-semibold">CUIT/CUIL: {client.cuit}</p>
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
                            <p className="font-medium">
                              {client.tracked_at 
                                ? new Date(client.tracked_at).toLocaleDateString('es-AR') 
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && !activeSearch && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev} 
                disabled={tokenStack.length === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Página {currentPage}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNext} 
                disabled={!nextToken}
                className="gap-1"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
