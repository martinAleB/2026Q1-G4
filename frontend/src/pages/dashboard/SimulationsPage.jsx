import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RefreshCw, Loader2, ChevronLeft, ChevronRight, Ban, Eye, Flag, Sparkles, AlertCircle, SearchX, Package } from 'lucide-react'

const TOKENS_KEY = 'cloud-dashboard-tokens'

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatARS(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatCuit(cuit) {
  if (!cuit || cuit.length !== 11) return cuit
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

function ScoreBadge({ score, estado }) {
  if (estado === 'pendiente') {
    return <span className="text-sm text-yellow-600">Pendiente</span>
  }
  if (estado === 'error') {
    return <span className="text-sm text-destructive">Error</span>
  }
  if (estado === 'sin_datos') {
    return <span className="text-sm text-muted-foreground">Sin datos</span>
  }
  if (estado === 'rechazado' || score === null || score === undefined) {
    return <span className="text-sm text-muted-foreground">-</span>
  }
  const multipliedScore = score * 10
  const color =
    multipliedScore >= 7 ? 'text-emerald-600' :
      multipliedScore >= 5 ? 'text-amber-600' :
        'text-red-600'
  return <span className={`text-sm font-medium ${color}`}>{multipliedScore.toFixed(2)}</span>
}

function EstadoBadge({ estado }) {
  if (estado === 'completado') return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Completado</Badge>
  if (estado === 'pendiente') return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Pendiente</Badge>
  if (estado === 'error') return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Error</Badge>
  if (estado === 'rechazado') return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Rechazado</Badge>
  if (estado === 'sin_datos') return <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">Sin datos</Badge>
  return <Badge variant="outline">{estado}</Badge>
}

function PriorityBadge({ value }) {
  const v = Number(value ?? 0)
  const color =
    v >= 8 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
      v >= 5 ? 'text-blue-600 border-blue-200 bg-blue-50' :
        'text-muted-foreground border-border bg-muted/40'
  return (
    <Badge variant="outline" className={`gap-1 ${color}`}>
      <Flag className="size-3" />
      Prioridad {v}
    </Badge>
  )
}

function ProductRow({ product, disabled }) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${disabled ? 'border-dashed bg-muted/30 opacity-60' : 'border-border bg-card hover:bg-muted/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatARS(product.amount)} · {product.installments} cuotas · {product.interest}% anual
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scoring admitido: <span className="font-medium text-foreground">{product.min_score} – {product.max_score}</span>
          </p>
          {disabled && product.reason && (
            <p className="text-xs text-orange-600 mt-1">{product.reason}</p>
          )}
        </div>
        <PriorityBadge value={product.priority} />
      </div>
    </div>
  )
}

function RecommendationsDialog({ open, onOpenChange, query, recommendations, isLoading, error }) {
  if (!query) return null

  const estado = query.estado
  const eligible = recommendations?.eligible || []
  const not_eligible = recommendations?.not_eligible || []
  const scoreX10 = recommendations?.client?.score_x10 ?? null
  const rejection_reasons = recommendations?.client?.rejection_reasons || query.rejection_reasons || []
  const error_message = recommendations?.client?.error_message || query.error_message || null

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Recomendaciones para {formatCuit(query.cuit)}</DialogTitle>
          <DialogDescription>
            {estado === 'completado' && scoreX10 !== null && (
              <>Score del cliente: <span className="font-semibold text-foreground">{scoreX10.toFixed(2)}</span> / 10</>
            )}
            {query.estado === 'rechazado' && 'Cliente descartado por la política general de la fintech.'}
            {query.estado === 'error' && 'La simulación falló por un error técnico.'}
            {query.estado === 'sin_datos' && 'No hay información crediticia disponible para este CUIT.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando recomendaciones…
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">No se pudieron cargar las recomendaciones</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && estado === 'rechazado' && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <div className="flex items-start gap-2">
                <Ban className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1.5">
                  <p className="font-medium">Motivos del rechazo</p>
                  {rejection_reasons.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5 text-xs">
                      {rejection_reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs">Sin detalle disponible.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && estado === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Error técnico</p>
                  <p className="text-xs">No fue posible establecer una conexión con el BCRA.</p>
                </div>
              </div>
            </div>
          )}

          {query.estado === 'sin_datos' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              <div className="flex items-start gap-2">
                <SearchX className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Sin historial crediticio</p>
                  <p className="text-xs">{query.error_message || 'El CUIT consultado no posee registros suficientes en el BCRA para generar un score.'}</p>
                </div>
              </div>
            </div>
          )}

          {query.estado === 'completado' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="font-semibold">Productos recomendados</h4>
                  <span className="text-xs text-muted-foreground">({eligible.length})</span>
                </div>
                {eligible.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">
                    Ningún producto coincide con el score del cliente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligible.map(p => <ProductRow key={p.product_id} product={p} disabled={false} />)}
                  </div>
                )}
              </div>

              {not_eligible.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="size-4 text-muted-foreground" />
                    <h4 className="font-semibold text-muted-foreground">No aplicables para este perfil</h4>
                    <span className="text-xs text-muted-foreground">({not_eligible.length})</span>
                  </div>
                  <div className="space-y-2">
                    {not_eligible.map(p => <ProductRow key={p.product_id} product={p} disabled />)}
                  </div>
                </div>
              )}
            </div>
          )
          }
        </div >

        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent >
    </DialogRoot >
  )
}

export default function SimulationsPage() {
  const navigate = useNavigate()
  const [cuit, setCuit] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [queries, setQueries] = useState([])
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [isLoadingRecs, setIsLoadingRecs] = useState(false)
  const [recsError, setRecsError] = useState('')
  const [page, setPage] = useState(1)
  const [hasProducts, setHasProducts] = useState(null) // null = loading
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(queries.length / PAGE_SIZE)
  const paginatedQueries = queries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    async function checkProducts() {
      try {
        const res = await fetch(`${import.meta.env.VITE_SIMULATIONS_API_URL}/product`, { headers: authHeaders() })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setHasProducts(Array.isArray(data) ? data.length > 0 : true)
      } catch {
        setHasProducts(true) // si falla, no bloqueamos
      }
    }
    checkProducts()
    handleRefresh()
  }, [])

  useEffect(() => {
    if (!selectedQuery) {
      setRecommendations(null)
      setRecsError('')
      return
    }
    fetchRecommendations(selectedQuery.id)
  }, [selectedQuery])

  const fetchRecommendations = async (taskId) => {
    setIsLoadingRecs(true)
    setRecsError('')
    setRecommendations(null)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SIMULATIONS_API_URL}/recommendations?task_id=${encodeURIComponent(taskId)}`,
        { headers: authHeaders() }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      setRecommendations(await res.json())
    } catch (e) {
      setRecsError(e.message || 'Error de red al cargar las recomendaciones')
    } finally {
      setIsLoadingRecs(false)
    }
  }

  const handleSimular = async () => {
    if (!cuit.trim() || cuit.length !== 11) return
    setIsLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SIMULATIONS_API_URL}/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ cuit: cuit })
      })
      if (!response.ok) {
        throw new Error('Error al iniciar la simulación')
      }
      setCuit('')
      await handleRefresh()
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SIMULATIONS_API_URL}/simulations`, {
        headers: authHeaders()
      })
      if (!response.ok) {
        throw new Error('Error al obtener los resultados')
      }
      const data = await response.json()

      if (data.results) {
        const mappedQueries = data.results.map(q => {
          let estado = 'pendiente'
          if (q.status === 'COMPLETED') estado = 'completado'
          else if (q.status === 'FAILED') estado = 'error'
          else if (q.status === 'REJECTED') estado = 'rechazado'
          else if (q.status === 'NO_DATA') estado = 'sin_datos'

          return {
            id: q.task_id,
            cuit: q.cuit,
            fechaConsulta: q.created_at,
            score: q.score ?? null,
            estado: estado,
            rejection_reasons: q.rejection_reasons || [],
            error_message: q.error_message || null,
          }
        })

        mappedQueries.sort((a, b) => new Date(b.fechaConsulta) - new Date(a.fechaConsulta))
        setQueries(mappedQueries)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCuitChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11)
    setCuit(val)
  }

  if (hasProducts === null) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasProducts) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <Package className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Configurá tus productos primero</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Para poder simular el score crediticio de un cliente necesitás tener al menos un producto financiero configurado. El simulador lo usará para recomendar los productos disponibles.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/products')}>
          <Package className="size-4" />
          Ir a Productos
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulador</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Consultá el score crediticio de un contribuyente por CUIT o CUIL.
          </p>
        </div>
      </div>

      {/* Form card */}
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Consultar Score Crediticio</CardTitle>
          <CardDescription>
            Ingresá el CUIT o CUIL de 11 dígitos para iniciar la consulta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT / CUIL</Label>
              <Input
                id="cuit"
                placeholder="Ej: 20123456789"
                autoComplete="off"
                value={cuit}
                onChange={handleCuitChange}
                maxLength={11}
                className="font-mono tracking-wider"
              />
              {cuit.length > 0 && cuit.length < 11 && (
                <p className="text-xs text-muted-foreground">
                  {11 - cuit.length} dígito{11 - cuit.length !== 1 ? 's' : ''} restante{11 - cuit.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <Button
              onClick={handleSimular}
              disabled={cuit.length !== 11 || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Consultando…
                </>
              ) : (
                <>
                  <Search className="size-4 mr-2" />
                  Simular
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queries table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Historial de consultas</h3>
            <p className="text-sm text-muted-foreground">
              Todas las consultas realizadas por tu fintech.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <Card className="p-2">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/5">CUIT / CUIL</TableHead>
                <TableHead className="w-1/5">Fecha de consulta</TableHead>
                <TableHead className="w-1/5">Score</TableHead>
                <TableHead className="w-1/5">Estado</TableHead>
                <TableHead className="w-1/5 text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQueries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="size-8 opacity-30" />
                      <span className="text-sm">No hay consultas registradas todavía.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedQueries.map((q) => {
                  const canOpen = q.estado === 'completado' || q.estado === 'rechazado' || q.estado === 'error' || q.estado === 'sin_datos'
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {formatCuit(q.cuit)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(q.fechaConsulta)}
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={q.score} estado={q.estado} />
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={q.estado} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={!canOpen}
                          onClick={() => setSelectedQuery(q)}
                          className="text-muted-foreground"
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">Ver detalle</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · {queries.length} consultas
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <RecommendationsDialog
        open={Boolean(selectedQuery)}
        onOpenChange={open => { if (!open) setSelectedQuery(null) }}
        query={selectedQuery}
        recommendations={recommendations}
        isLoading={isLoadingRecs}
        error={recsError}
      />
    </div>
  )
}
