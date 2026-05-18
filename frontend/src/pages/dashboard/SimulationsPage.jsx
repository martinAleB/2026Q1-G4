import { useState, useEffect } from 'react'
import { Search, RefreshCw, Clock, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="size-3.5" />
        Pendiente
      </span>
    )
  }
  if (estado === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
        <XCircle className="size-3.5" />
        Error
      </span>
    )
  }
  const multipliedScore = score !== null && score !== undefined ? score * 10 : 0;
  const color =
    multipliedScore >= 7 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    multipliedScore >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                  'text-red-600 bg-red-50 border-red-200'

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2 py-0.5 rounded-md border ${color}`}>
      <CheckCircle2 className="size-3.5" />
      {score !== null && score !== undefined ? multipliedScore.toFixed(2) : '-'}
    </span>
  )
}

function EstadoBadge({ estado }) {
  if (estado === 'completado') return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Completado</Badge>
  if (estado === 'pendiente') return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pendiente</Badge>
  if (estado === 'error') return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Error</Badge>
  return <Badge variant="outline">{estado}</Badge>
}

export default function SimulationsPage() {
  const [cuit, setCuit] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [queries, setQueries] = useState([])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(queries.length / PAGE_SIZE)
  const paginatedQueries = queries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    handleRefresh()
  }, [])

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

          return {
            id: q.task_id,
            cuit: q.cuit,
            fechaConsulta: q.created_at,
            score: q.score || null,
            estado: estado
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">CUIT / CUIL</TableHead>
                <TableHead>Fecha de consulta</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQueries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="size-8 opacity-30" />
                      <span className="text-sm">No hay consultas registradas todavía.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedQueries.map((q) => (
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
                  </TableRow>
                ))
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
    </div>
  )
}