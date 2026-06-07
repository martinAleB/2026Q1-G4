import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  BarChart3,
  FlaskConical,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CreditCard,
  ShieldAlert,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  UserX,
  UserCheck,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/store/AuthContext'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const API = import.meta.env.VITE_SIMULATIONS_API_URL
const TOKENS_KEY = 'cloud-dashboard-tokens'

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

function formatARS(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatPct(num, denom) {
  if (!denom) return '0%'
  return `${((num / denom) * 100).toFixed(1)}%`
}

function formatScore(s) {
  if (s === null || s === undefined || isNaN(s)) return '—'
  return (parseFloat(s) * 10).toFixed(2)
}

function DeltaBadge({ value, inverse = false }) {
  if (value === 0 || value === null || value === undefined) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3" /> Sin cambio</span>
  const positive = inverse ? value < 0 : value > 0
  const cls = positive ? 'text-emerald-600' : 'text-red-500'
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="size-3" />
      {Math.abs(value)}
    </span>
  )
}

function SliderField({ id, label, value, min, max, step = 1, onChange, format }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="min-w-[72px] rounded-lg border bg-muted/60 px-2 py-0.5 text-center text-sm font-semibold tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        style={{ backgroundImage: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

const APPROVAL_CONFIG = {
  approvedPct: { label: 'Elegibles (%)', color: 'hsl(var(--primary))' },
}

function ApprovalBarChart({ currentCount, simulatedCount, total }) {
  const data = [
    {
      name: 'Act.',
      approvedPct: total ? Number(((currentCount / total) * 100).toFixed(1)) : 0,
      approvedCount: currentCount,
    },
    {
      name: 'Sim.',
      approvedPct: total ? Number(((simulatedCount / total) * 100).toFixed(1)) : 0,
      approvedCount: simulatedCount,
    },
  ]

  return (
    <div className="w-full h-[120px]">
      <ChartContainer config={APPROVAL_CONFIG} className="h-full w-full">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} className="fill-muted-foreground text-xs" />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs font-semibold"
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => [`${value}% (${item.payload.approvedCount} clientes)`, 'Elegibles']}
              />
            }
          />
          <Bar dataKey="approvedPct" radius={[0, 4, 4, 0]}>
            <Cell fill="#3b82f6" />
            <Cell fill="#10b981" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

const REJECTION_CONFIG = {
  value: { label: 'Rechazados' },
  situacion: { label: 'Situación crediticia', color: '#6366f1' },
  entidades: { label: 'Cant. entidades', color: '#06b6d4' },
  deuda: { label: 'Deuda total', color: '#3b82f6' },
  meses: { label: 'Meses en sit. 1', color: '#a855f7' },
  dias: { label: 'Días de atraso', color: '#ec4899' },
  judicial: { label: 'Proceso judicial', color: '#f43f5e' },
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Sin rechazos bajo la configuración simulada</div>

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="w-[140px] h-[140px] shrink-0 mx-auto sm:mx-0">
        <ChartContainer config={REJECTION_CONFIG} className="h-full w-full aspect-square">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="reason"
              innerRadius={45}
              outerRadius={65}
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={REJECTION_CONFIG[entry.reason]?.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
      <ul className="space-y-1.5 text-xs min-w-0 flex-1">
        {data.map((entry) => {
          const cfg = REJECTION_CONFIG[entry.reason]
          const pct = entry.value / total
          return (
            <li key={entry.reason} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: cfg?.color }} />
                <span className="truncate text-muted-foreground">{cfg?.label}</span>
              </span>
              <span className="font-medium tabular-nums shrink-0">{entry.value} <span className="text-muted-foreground font-normal">({(pct * 100).toFixed(0)}%)</span></span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const SCORE_CONFIG = {
  count: { label: 'Clientes' },
  low: { label: 'Bajo (<4)', color: '#f43f5e' },
  mid: { label: 'Medio (4–7)', color: '#fbbf24' },
  high: { label: 'Alto (≥7)', color: '#10b981' },
}

function ScoreDistChart({ high, mid, low }) {
  const data = [
    { name: 'Bajo (<4)', count: low, key: 'low' },
    { name: 'Medio (4–7)', count: mid, key: 'mid' },
    { name: 'Alto (≥7)', count: high, key: 'high' },
  ]

  return (
    <div className="w-full h-[180px]">
      <ChartContainer config={SCORE_CONFIG} className="h-full w-full">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="fill-muted-foreground text-xs"
            allowDecimals={false}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SCORE_CONFIG[entry.key]?.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function StatCard({ icon: Icon, label, current, simulated, delta, format = v => v, prefix = '', inverse = false }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold tabular-nums">{prefix}{format(simulated)}</p>
          <p className="text-xs text-muted-foreground">Actual: {prefix}{format(current)}</p>
        </div>
        <DeltaBadge value={delta} inverse={inverse} />
      </div>
    </div>
  )
}

function EmptyState({ portfolioCount, onGoToSimulations }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-dashed bg-muted/20 p-12 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
        <FlaskConical className="size-10 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-semibold">Sin datos para simular</h2>
        <p className="text-sm text-muted-foreground">
          {portfolioCount === 0
            ? 'Tu cartera no tiene clientes todavía. Primero ejecutá simulaciones individuales para que los clientes queden con score calculado.'
            : `Tenés ${portfolioCount} cliente${portfolioCount !== 1 ? 's' : ''} en cartera, pero ninguno tiene score calculated aún. Esperá a que las simulaciones se procesen y volvé a intentarlo.`}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onGoToSimulations}>
          <Users className="size-4 mr-2" />
          Ir al Simulador individual
        </Button>
      </div>
    </div>
  )
}

const DEFAULTS = {
  sim_sit: 2,
  sim_cant: 3,
  sim_deuda: 350000,
  sim_meses: 6,
  sim_dias: 30,
  sim_proceso: false,
}

export default function SimulationConfigPage() {
  const { fintechData } = useAuth()
  const [params, setParams] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasRun, setHasRun] = useState(false)

  const curr = useMemo(() => ({
    curr_sit: fintechData?.max_situacion_crediticia ?? 2,
    curr_cant: fintechData?.max_entidades_con_deuda ?? 3,
    curr_deuda: fintechData?.max_deuda_total_ars ?? 350000,
    curr_meses: fintechData?.min_meses_situacion_1 ?? 6,
    curr_dias: fintechData?.max_dias_atraso ?? 30,
    curr_proceso: fintechData?.permite_proceso_judicial ?? false,
  }), [fintechData])

  function setParam(key, value) {
    setParams(p => ({ ...p, [key]: value }))
  }

  const runSimulation = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const queryParams = new URLSearchParams({ ...curr, ...params }).toString()
      const res = await fetch(`${API}/simulations/simulate-config?${queryParams}`, {
        method: 'GET',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      const isPortfolioEmpty = res.headers.get('x-portfolio-empty') === 'true' || data.empty === true;
      setResult({
        ...data,
        empty: isPortfolioEmpty
      })
      setHasRun(true)
    } catch (err) {
      setError(err.message || 'Error al ejecutar la simulación')
    } finally {
      setIsLoading(false)
    }
  }, [params, curr])


  const goToSimulations = () => {
    window.location.hash = '/dashboard/simulations'
  }

  const rejectionData = result && !result.empty ? [
    { reason: 'situacion', value: result.reject_by_situacion ?? 0 },
    { reason: 'entidades', value: result.reject_by_entidades ?? 0 },
    { reason: 'deuda', value: result.reject_by_deuda ?? 0 },
    { reason: 'meses', value: result.reject_by_meses ?? 0 },
    { reason: 'dias', value: result.reject_by_dias ?? 0 },
    { reason: 'judicial', value: result.reject_by_judicial ?? 0 },
  ].filter(d => d.value > 0) : []

  const approvalDelta = result && !result.empty
    ? result.simulated_approved_count - result.current_approved_count
    : null

  const scoreDelta = result && !result.empty && result.current_avg_score && result.simulated_avg_score
    ? parseFloat((parseFloat(result.simulated_avg_score) - parseFloat(result.current_avg_score)).toFixed(4))
    : null

  const debtDelta = result && !result.empty && result.simulated_eligible_debt !== null
    ? Math.round(result.simulated_eligible_debt - (result.current_eligible_debt ?? 0))
    : null

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Simulador de Configuraciones</h1>
        <p className="text-muted-foreground">
          Ajustá los parámetros y ejecutá la simulación para ver cómo impactan sobre la elegibilidad de tu cartera.
        </p>
      </div>

      {result?.empty && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Cartera vacía o sin analizar</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
              No tenés clientes con score en la cartera. No se pueden realizar comparativas hasta que ejecutes alguna simulación individual.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Parámetros simulados
              </CardTitle>
              <CardDescription>
                La configuración actual de tu fintech aparece en los gráficos como referencia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SliderField
                id="sim_sit"
                label="Situación máxima (BCRA)"
                value={params.sim_sit}
                min={1}
                max={5}
                onChange={v => setParam('sim_sit', v)}
              />
              <SliderField
                id="sim_cant"
                label="Máx. entidades con deuda"
                value={params.sim_cant}
                min={0}
                max={20}
                onChange={v => setParam('sim_cant', v)}
              />
              <SliderField
                id="sim_deuda"
                label="Deuda máxima total (ARS)"
                value={params.sim_deuda}
                min={0}
                max={5000000}
                step={10000}
                format={v => formatARS(v)}
                onChange={v => setParam('sim_deuda', v)}
              />
              <SliderField
                id="sim_meses"
                label="Meses mínimos en sit. 1"
                value={params.sim_meses}
                min={0}
                max={24}
                onChange={v => setParam('sim_meses', v)}
              />
              <SliderField
                id="sim_dias"
                label="Máx. días de atraso"
                value={params.sim_dias}
                min={0}
                max={365}
                onChange={v => setParam('sim_dias', v)}
              />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Permitir proceso judicial</span>
                <div className="inline-flex gap-1 rounded-3xl border border-border bg-input/50 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={params.sim_proceso ? 'default' : 'ghost'}
                    onClick={() => setParam('sim_proceso', true)}
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!params.sim_proceso ? 'default' : 'ghost'}
                    onClick={() => setParam('sim_proceso', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              <Button
                id="btn-run-simulation"
                className="w-full gap-2"
                onClick={runSimulation}
                disabled={isLoading || result?.empty}
              >
                {isLoading ? (
                  <><Loader2 className="size-4 animate-spin" /> Calculando...</>
                ) : (
                  <><FlaskConical className="size-4" /> Ejecutar simulación</>
                )}
              </Button>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!hasRun && !isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/20 p-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <FlaskConical className="size-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Ajustá los parámetros y ejecutá la simulación</p>
                <p className="text-sm text-muted-foreground">Los resultados aparecerán aquí</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-3 rounded-3xl border bg-muted/20 p-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <span>Analizando tu cartera…</span>
            </div>
          )}

          {hasRun && result?.empty && (
            <EmptyState
              portfolioCount={result.total_portfolio_count ?? 0}
              onGoToSimulations={goToSimulations}
            />
          )}

          {hasRun && result && !result.empty && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={Users}
                  label="Aprobados"
                  current={result.current_approved_count}
                  simulated={result.simulated_approved_count}
                  delta={approvalDelta}
                />
                <StatCard
                  icon={UserCheck}
                  label="Nuevos elegibles"
                  current={0}
                  simulated={result.newly_eligible}
                  delta={result.newly_eligible}
                />
                <StatCard
                  icon={UserX}
                  label="Nuevos rechazados"
                  current={0}
                  simulated={result.newly_rejected}
                  delta={result.newly_rejected}
                  inverse
                />
                <StatCard
                  icon={CreditCard}
                  label="Score promedio"
                  current={formatScore(result.current_avg_score)}
                  simulated={formatScore(result.simulated_avg_score)}
                  delta={scoreDelta !== null ? parseFloat((scoreDelta * 10).toFixed(3)) : null}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-primary" />
                    Tasa de aprobación
                  </CardTitle>
                  <CardDescription>
                    Comparativa entre la configuración actual y la simulada sobre {result.total_portfolio} clientes con score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ApprovalBarChart
                    currentCount={result.current_approved_count}
                    simulatedCount={result.simulated_approved_count}
                    total={result.total_portfolio}
                  />
                  <div className="mt-4 flex flex-wrap gap-4 text-sm border-t pt-4">
                    <div className="flex items-center gap-1.5">
                      {approvalDelta > 0 ? <TrendingUp className="size-4 text-emerald-500" /> : approvalDelta < 0 ? <TrendingDown className="size-4 text-red-500" /> : <Minus className="size-4 text-muted-foreground" />}
                      <span className="text-muted-foreground">Variación: </span>
                      <span className={`font-semibold ${approvalDelta > 0 ? 'text-emerald-600' : approvalDelta < 0 ? 'text-red-500' : ''}`}>
                        {approvalDelta > 0 ? '+' : ''}{approvalDelta} clientes ({formatPct(Math.abs(approvalDelta), result.total_portfolio)})
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlert className="size-4 text-amber-500" />
                      Causas de rechazo (simulado)
                    </CardTitle>
                    <CardDescription>
                      Distribución de los {result.total_portfolio - result.simulated_approved_count} clientes no elegibles bajo la configuración simulada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={rejectionData} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="size-4 text-primary" />
                      Distribución de score
                    </CardTitle>
                    <CardDescription>
                      Score mediano: {formatScore(result.median_score)} / 10
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScoreDistChart
                      high={result.high_score_count ?? 0}
                      mid={result.mid_score_count ?? 0}
                      low={result.low_score_count ?? 0}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-6 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Banknote className="size-3.5" /> Deuda elegible actual
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{formatARS(result.current_eligible_debt)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Banknote className="size-3.5" /> Deuda elegible simulada
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{formatARS(result.simulated_eligible_debt)}</p>
                    {debtDelta !== null && (
                      <p className={`text-xs font-medium ${debtDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {debtDelta >= 0 ? '+' : ''}{formatARS(debtDelta)} vs. actual
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide pb-2">Perfil de cartera</p>
                    <div className="space-y-0.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prom. entidades</span>
                        <span className="font-medium">{result.avg_entidades ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prom. deuda</span>
                        <span className="font-medium">{formatARS(result.avg_deuda)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prom. meses sit.1</span>
                        <span className="font-medium">{result.avg_meses_sit1 ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Con proceso judicial</span>
                        <span className="font-medium">{result.count_judicial ?? 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
