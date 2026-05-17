import { useState, useEffect } from 'react'
import { Plus, MoreVertical, Package, Percent, Wallet, Pencil, Trash2 } from 'lucide-react'

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
  { producto_id: 'mock-1', sub: 'mock-sub-123', nombre: 'Préstamo Personal Plus', monto: 500000, cuotas: 24, interes: 45, min_score: 4.5, max_score: 8.5 },
  { producto_id: 'mock-2', sub: 'mock-sub-123', nombre: 'Microcrédito Express',   monto:  80000, cuotas:  6, interes: 65, min_score: 2.0, max_score: 5.5 },
]

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

const EMPTY_FORM = {
  nombre: '', monto: '', cuotas: '', interes: '', min_score: '', max_score: '',
}

const FIELDS = [
  { key: 'nombre',       label: 'Nombre del producto',           type: 'text',   placeholder: 'Ej: Préstamo Personal Plus', colSpan: 2 },
  { key: 'monto',        label: 'Monto (ARS)',                   type: 'number', placeholder: 'Ej: 500000' },
  { key: 'cuotas',       label: 'Cuotas (meses)',                type: 'number', placeholder: 'Ej: 24' },
  { key: 'interes',      label: 'Tasa de interés anual (%)',      type: 'number', placeholder: 'Ej: 45' },
  { key: 'min_score', label: 'Scoring mínimo permitido',      type: 'number', placeholder: '0.00 – 10.00', step: '0.01' },
  { key: 'max_score', label: 'Scoring máximo permitido',      type: 'number', placeholder: '0.00 – 10.00', step: '0.01' },
]

function formatARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function ProductForm({ open, onOpenChange, initial, onSubmit, isSaving }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        nombre:       initial.nombre,
        monto:        String(initial.monto),
        cuotas:       String(initial.cuotas),
        interes:      String(initial.interes),
        min_score: String(initial.min_score),
        max_score: String(initial.max_score),
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
      nombre:       form.nombre.trim(),
      monto:        parseFloat(form.monto),
      cuotas:       parseInt(form.cuotas),
      interes:      parseFloat(form.interes),
      min_score: parseFloat(form.min_score),
      max_score: parseFloat(form.max_score),
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

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Condiciones financieras */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.slice(0, 4).map(({ key, label, type, placeholder, colSpan, step }) => (
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
              {FIELDS.slice(4).map(({ key, label, type, placeholder, colSpan, step }) => (
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
          <CardTitle className="text-base leading-snug">{product.nombre}</CardTitle>
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
            <p className="font-medium">{formatARS(product.monto)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cuotas (plazo)</p>
            <p className="font-medium">{product.cuotas} meses</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tasa anual</p>
            <p className="font-medium">{product.interes}%</p>
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Scoring admitido: <span className="font-semibold text-foreground">{product.min_score} – {product.max_score}</span>
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

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setIsLoading(true)
    try {
      const res = await fetch(`${API}/producto`, { headers: authHeaders() })
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
    try {
      const res = await fetch(`${API}/producto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setProducts(p => [created, ...p])
      setFormOpen(false)
    } catch { /* no cierra el modal en error */ }
    finally { setIsSaving(false) }
  }

  async function handleUpdate(data) {
    setIsSaving(true)
    try {
      const res = await fetch(`${API}/producto/${editingProduct.producto_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setProducts(p => p.map(x => x.producto_id === updated.producto_id ? updated : x))
      setFormOpen(false)
      setEditingProduct(null)
    } catch { }
    finally { setIsSaving(false) }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`${API}/producto/${deleteTarget.producto_id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error()
      setProducts(p => p.filter(x => x.producto_id !== deleteTarget.producto_id))
      setDeleteTarget(null)
    } catch { }
    finally { setIsDeleting(false) }
  }

  function openCreate() { setEditingProduct(null); setFormOpen(true) }
  function openEdit(product) { setEditingProduct(product); setFormOpen(true) }

  const avgInteres = products.length
    ? (products.reduce((s, p) => s + p.interes, 0) / products.length).toFixed(1)
    : '—'
  const avgMonto = products.length
    ? formatARS(products.reduce((s, p) => s + p.monto, 0) / products.length)
    : '—'

  const metrics = [
    { title: 'Productos activos', value: products.length, description: 'Oferta vigente para recomendación', icon: Package },
    { title: 'Tasa promedio', value: products.length ? `${avgInteres}%` : '—', description: 'Promedio ponderado de configuraciones', icon: Percent },
    { title: 'Ticket promedio', value: avgMonto, description: 'Monto medio entre productos activos', icon: Wallet },
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
              key={product.producto_id}
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
        onOpenChange={open => { setFormOpen(open); if (!open) setEditingProduct(null) }}
        initial={editingProduct}
        onSubmit={editingProduct ? handleUpdate : handleCreate}
        isSaving={isSaving}
      />

      {/* Modal confirmar eliminación */}
      <AlertDialogRoot open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-medium text-foreground">"{deleteTarget?.nombre}"</span>. Esta acción no se puede deshacer.
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
