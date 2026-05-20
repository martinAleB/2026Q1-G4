import { useState, useEffect } from 'react'
import { Plus, MoreVertical, Package, Percent, Wallet, Pencil, Trash2, Flag, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DialogRoot, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialogRoot, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const API = import.meta.env.VITE_SIMULATIONS_API_URL
const MOCK = import.meta.env.VITE_MOCK === 'true'
const TOKENS_KEY = 'cloud-dashboard-tokens'

const MOCK_PRODUCTS = [
  { product_id: 'mock-1', sub: 'mock-sub-123', name: 'Préstamo Personal Plus', amount: 500000, installments: 24, interest: 45, min_score: 4.5, max_score: 8.5, priority: 8 },
  { product_id: 'mock-2', sub: 'mock-sub-123', name: 'Microcrédito Express',   amount:  80000, installments:  6, interest: 65, min_score: 2.0, max_score: 5.5, priority: 4 },
]

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

const EMPTY_FORM = {
  name: '', amount: '', installments: '', interest: '', min_score: '', max_score: '', priority: '',
}

const FIELDS = [
  { key: 'name',         label: 'Nombre del producto',           type: 'text',   placeholder: 'Ej: Préstamo Personal Plus', colSpan: 2 },
  { key: 'amount',       label: 'Monto (ARS)',                   type: 'number', placeholder: 'Ej: 500000' },
  { key: 'installments', label: 'Cuotas (meses)',                type: 'number', placeholder: 'Ej: 24' },
  { key: 'interest',     label: 'Tasa de interés anual (%)',     type: 'number', placeholder: 'Ej: 45' },
  { key: 'priority',     label: 'Prioridad comercial',           type: 'number', placeholder: '1 – 10', step: '1' },
  { key: 'min_score',    label: 'Scoring mínimo permitido',      type: 'number', placeholder: '0.00 – 10.00', step: '0.01' },
  { key: 'max_score',    label: 'Scoring máximo permitido',      type: 'number', placeholder: '0.00 – 10.00', step: '0.01' },
]

function formatARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function ProductForm({ open, onOpenChange, initial, onSubmit, isSaving, submitError }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name:         initial.name,
        amount:       String(initial.amount),
        installments: String(initial.installments),
        interest:     String(initial.interest),
        min_score:    String(initial.min_score),
        max_score:    String(initial.max_score),
        priority:     String(initial.priority ?? ''),
      } : EMPTY_FORM)
      setErrors({})
    }
  }, [open, initial])

  function validate() {
    const e = {}
    FIELDS.forEach(({ key }) => {
      if (!form[key].toString().trim()) e[key] = 'Requerido'
    })
    const min = parseFloat(form.min_score)
    const max = parseFloat(form.max_score)
    if (!e.min_score && (isNaN(min) || min < 0 || min > 10)) e.min_score = 'Debe ser entre 0 y 10'
    if (!e.max_score && (isNaN(max) || max < 0 || max > 10)) e.max_score = 'Debe ser entre 0 y 10'
    if (!e.min_score && !e.max_score && min > max) e.max_score = 'Debe ser ≥ al mínimo'
    const pri = parseInt(form.priority, 10)
    if (!e.priority && (isNaN(pri) || pri < 1 || pri > 10 || !Number.isInteger(parseFloat(form.priority)))) {
      e.priority = 'Debe ser un entero entre 1 y 10'
    }
    return e
  }

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length > 0) { setErrors(e2); return }
    onSubmit({
      name:         form.name.trim(),
      amount:       parseFloat(form.amount),
      installments: parseInt(form.installments),
      interest:     parseFloat(form.interest),
      min_score:    parseFloat(form.min_score),
      max_score:    parseFloat(form.max_score),
      priority:     parseInt(form.priority, 10),
    })
  }

  const isEdit = Boolean(initial)

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? 'Editar producto' : 'Agregar producto'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modificá los parámetros del producto financiero.' : 'Completá los parámetros del nuevo producto financiero.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2" noValidate>
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Condiciones financieras */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.slice(0, 5).map(({ key, label, type, placeholder, colSpan, step }) => (
                <div key={key} className={`space-y-1.5 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    aria-invalid={Boolean(errors[key])}
                    min={type === 'number' ? 0 : undefined}
                    step={step}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                  {errors[key] && (
                    <p className="text-xs text-destructive font-medium">{errors[key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Requisitos de elegibilidad */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.slice(5).map(({ key, label, type, placeholder, colSpan, step }) => (
                <div key={key} className={`space-y-1.5 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    aria-invalid={Boolean(errors[key])}
                    min={type === 'number' ? 0 : undefined}
                    step={step}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                  {errors[key] && (
                    <p className="text-xs text-destructive font-medium">{errors[key]}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Estás configurando el intervalo de nuestro scoring personal generado por el modelo (0 a 10).
            </p>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

function ProductCard({ product, onEdit, onDelete }) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 -mt-1 -mr-1 text-muted-foreground">
                <MoreVertical className="size-4" />
                <span className="sr-only">Opciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Pencil className="size-3.5" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => onDelete(product)}>
                <Trash2 className="size-3.5" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Monto</p>
            <p className="font-medium">{formatARS(product.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cuotas (plazo)</p>
            <p className="font-medium">{product.installments} meses</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tasa anual</p>
            <p className="font-medium">{product.interest}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Flag className="size-3" />
              Prioridad
            </p>
            <p className="font-medium">{product.priority ?? '—'} / 10</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Scoring admitido</p>
            <p className="font-medium">{product.min_score} – {product.max_score}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState(MOCK ? MOCK_PRODUCTS : [])
  const [isLoading, setIsLoading] = useState(!MOCK)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setIsLoading(true)
    try {
      const res = await fetch(`${API}/product`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      setProducts(await res.json())
    } catch {
      /* mantiene la lista vacía si falla */
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate(data) {
    setIsSaving(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API}/product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      const created = await res.json()
      setProducts(p => [created, ...p])
      setFormOpen(false)
    } catch (e) {
      setSubmitError(e.message || 'No se pudo crear el producto')
    }
    finally { setIsSaving(false) }
  }

  async function handleUpdate(data) {
    setIsSaving(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API}/product/${editingProduct.product_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      const updated = await res.json()
      setProducts(p => p.map(x => x.product_id === updated.product_id ? updated : x))
      setFormOpen(false)
      setEditingProduct(null)
    } catch (e) {
      setSubmitError(e.message || 'No se pudo actualizar el producto')
    }
    finally { setIsSaving(false) }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`${API}/product/${deleteTarget.product_id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error()
      setProducts(p => p.filter(x => x.product_id !== deleteTarget.product_id))
      setDeleteTarget(null)
    } catch { }
    finally { setIsDeleting(false) }
  }

  function openCreate() { setEditingProduct(null); setSubmitError(''); setFormOpen(true) }
  function openEdit(product) { setEditingProduct(product); setSubmitError(''); setFormOpen(true) }

  const avgInterest = products.length
    ? (products.reduce((s, p) => s + p.interest, 0) / products.length).toFixed(1)
    : '—'
  const avgAmount = products.length
    ? formatARS(products.reduce((s, p) => s + p.amount, 0) / products.length)
    : '—'

  const metrics = [
    { title: 'Productos activos', value: products.length, description: 'Oferta vigente para recomendación', icon: Package },
    { title: 'Tasa promedio', value: products.length ? `${avgInterest}%` : '—', description: 'Promedio ponderado de configuraciones', icon: Percent },
    { title: 'Ticket promedio', value: avgAmount, description: 'Monto medio entre productos activos', icon: Wallet },
  ]

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Productos financieros</h1>
          <p className="text-muted-foreground">Configurá la oferta crediticia de tu fintech.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Agregar producto
        </Button>
      </div>

      {/* Métricas */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ title, value, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Grid de productos */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Cargando productos…
        </div>
      ) : products.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-muted-foreground">
          <Package className="size-8 opacity-30" />
          <p className="text-sm">Todavía no hay productos. Agregá uno para empezar.</p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Agregar producto
          </Button>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map(product => (
            <ProductCard
              key={product.product_id}
              product={product}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </section>
      )}

      {/* Modal crear / editar */}
      <ProductForm
        open={formOpen}
        onOpenChange={open => { setFormOpen(open); if (!open) { setEditingProduct(null); setSubmitError('') } }}
        initial={editingProduct}
        onSubmit={editingProduct ? handleUpdate : handleCreate}
        isSaving={isSaving}
        submitError={submitError}
      />

      {/* Modal confirmar eliminación */}
      <AlertDialogRoot open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </div>
  )
}
