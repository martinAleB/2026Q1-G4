import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/store/AuthContext'

const API = import.meta.env.VITE_SIMULATIONS_API_URL
const MOCK = import.meta.env.VITE_MOCK === 'true'
const TOKENS_KEY = 'cloud-dashboard-tokens'

const DEFAULTS = {
  max_situacion_crediticia: 2,
  max_entidades_con_deuda: 3,
  max_deuda_total_ars: 350000,
  min_meses_situacion_1: 6,
  max_dias_atraso: 30,
  permite_proceso_judicial: false,
}

const NUMERIC_FIELDS = [
  {
    key: 'max_situacion_crediticia',
    label: 'Máxima situación crediticia permitida',
    placeholder: '1 – 5',
    step: '1',
    min: 1,
    max: 5,
    description: 'Umbral principal para habilitar la evaluación. Situaciones BCRA del 1 (normal) al 5 (irrecuperable).',
  },
  {
    key: 'max_entidades_con_deuda',
    label: 'Máximo de entidades con deuda',
    placeholder: 'Ej: 3',
    step: '1',
    min: 0,
    description: 'Cantidad máxima de bancos con deuda activa simultánea para evitar sobreendeudamiento.',
  },
  {
    key: 'max_deuda_total_ars',
    label: 'Máxima deuda total externa (ARS)',
    placeholder: 'Ej: 350000',
    step: '1000',
    min: 0,
    description: 'Tope en pesos de la deuda total reportada en BCRA en el último período.',
  },
  {
    key: 'min_meses_situacion_1',
    label: 'Meses mínimos en situación 1 (últimos 24)',
    placeholder: '0 – 24',
    step: '1',
    min: 0,
    max: 24,
    description: 'Cantidad mínima de meses con situación BCRA óptima dentro de los últimos 24.',
  },
  {
    key: 'max_dias_atraso',
    label: 'Máximos días de atraso (período actual)',
    placeholder: 'Ej: 30',
    step: '1',
    min: 0,
    description: 'Tolerancia máxima de atraso de pago reportado en el último período.',
  },
]

const BOOL_FIELD = {
  key: 'permite_proceso_judicial',
  label: 'Permitir clientes con proceso judicial activo',
  description: 'Si está deshabilitado, cualquier juicio activo descarta automáticamente al cliente.',
}

function formatRangeError(field) {
  if (field.min !== undefined && field.max !== undefined) {
    return `Debe ser un valor entre ${field.min} y ${field.max}`
  }
  if (field.min !== undefined) return `Debe ser un valor mayor o igual a ${field.min}`
  if (field.max !== undefined) return `Debe ser un valor menor o igual a ${field.max}`
  return 'Valor inválido'
}

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

function pickValues(source) {
  return {
    max_situacion_crediticia: source?.max_situacion_crediticia ?? DEFAULTS.max_situacion_crediticia,
    max_entidades_con_deuda: source?.max_entidades_con_deuda ?? DEFAULTS.max_entidades_con_deuda,
    max_deuda_total_ars: source?.max_deuda_total_ars ?? DEFAULTS.max_deuda_total_ars,
    min_meses_situacion_1: source?.min_meses_situacion_1 ?? DEFAULTS.min_meses_situacion_1,
    max_dias_atraso: source?.max_dias_atraso ?? DEFAULTS.max_dias_atraso,
    permite_proceso_judicial: source?.permite_proceso_judicial ?? DEFAULTS.permite_proceso_judicial,
  }
}

function toFormState(values) {
  return {
    max_situacion_crediticia: String(values.max_situacion_crediticia),
    max_entidades_con_deuda: String(values.max_entidades_con_deuda),
    max_deuda_total_ars: String(values.max_deuda_total_ars),
    min_meses_situacion_1: String(values.min_meses_situacion_1),
    max_dias_atraso: String(values.max_dias_atraso),
    permite_proceso_judicial: Boolean(values.permite_proceso_judicial),
  }
}

export default function ParametersPage() {
  const { fintechData, refreshFintech } = useAuth()

  const initialValues = useMemo(() => pickValues(fintechData), [fintechData])
  const [form, setForm] = useState(() => toFormState(initialValues))
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    setForm(toFormState(initialValues))
  }, [initialValues])

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n })
    if (showSuccess) setShowSuccess(false)
    if (submitError) setSubmitError('')
  }

  function validate() {
    const e = {}
    for (const field of NUMERIC_FIELDS) {
      const raw = form[field.key]
      if (raw === '' || raw === null || raw === undefined) {
        e[field.key] = 'Requerido'
        continue
      }
      const num = Number(raw)
      if (Number.isNaN(num)) { e[field.key] = 'Debe ser un número'; continue }
      if (field.step === '1' && !Number.isInteger(num)) { e[field.key] = 'Debe ser un entero'; continue }
      if (field.min !== undefined && num < field.min) { e[field.key] = formatRangeError(field); continue }
      if (field.max !== undefined && num > field.max) { e[field.key] = formatRangeError(field); continue }
    }
    return e
  }

  function buildPayload() {
    return {
      max_situacion_crediticia: parseInt(form.max_situacion_crediticia, 10),
      max_entidades_con_deuda: parseInt(form.max_entidades_con_deuda, 10),
      max_deuda_total_ars: parseFloat(form.max_deuda_total_ars),
      min_meses_situacion_1: parseInt(form.min_meses_situacion_1, 10),
      max_dias_atraso: parseInt(form.max_dias_atraso, 10),
      permite_proceso_judicial: Boolean(form.permite_proceso_judicial),
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const payload = buildPayload()
    setIsSaving(true)
    setSubmitError('')
    setShowSuccess(false)

    if (MOCK) {
      await new Promise(r => setTimeout(r, 400))
      setIsSaving(false)
      setShowSuccess(true)
      return
    }

    try {
      const res = await fetch(`${API}/fintech`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudieron guardar los parámetros')
      }
      await refreshFintech()
      setShowSuccess(true)
    } catch (err) {
      setSubmitError(err.message || 'Error de red al guardar los parámetros')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Parámetros</h1>
        <p className="text-muted-foreground">
          Configuración general de tu fintech. Estos umbrales se aplican antes del scoring por producto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-primary" />
            Elegibilidad crediticia
          </CardTitle>
          <CardDescription>
            Filtro previo sobre los datos del BCRA. Los clientes que no cumplan estos umbrales se descartan antes del scoring por producto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            {showSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>Parámetros actualizados correctamente.</span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {NUMERIC_FIELDS.map(({ key, label, placeholder, step, min, max, description }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    aria-invalid={Boolean(errors[key])}
                    step={step}
                    min={min}
                    max={max}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                  {errors[key] ? (
                    <p className="text-xs text-destructive font-medium">{errors[key]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{description}</p>
                  )}
                </div>
              ))}

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={BOOL_FIELD.key}>{BOOL_FIELD.label}</Label>
                <div className="inline-flex gap-1 rounded-3xl border border-border bg-input/50 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={form.permite_proceso_judicial ? 'default' : 'ghost'}
                    onClick={() => handleChange('permite_proceso_judicial', true)}
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!form.permite_proceso_judicial ? 'default' : 'ghost'}
                    onClick={() => handleChange('permite_proceso_judicial', false)}
                  >
                    No
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{BOOL_FIELD.description}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
