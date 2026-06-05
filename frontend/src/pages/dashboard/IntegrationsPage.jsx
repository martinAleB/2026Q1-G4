import { useState, useEffect } from 'react'
import {
  Copy, RefreshCw, Loader2, KeyRound, AlertCircle,
  CheckCheck, TriangleAlert, Plus, RotateCcw, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialogRoot, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const TOKENS_KEY = 'cloud-dashboard-tokens'
const MOCK = import.meta.env.VITE_MOCK === 'true'

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
    if (tokens?.idToken) return { Authorization: `Bearer ${tokens.idToken}` }
  } catch { /* */ }
  return {}
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback para contextos no-HTTPS (ej: S3 http://)
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

function CopyButton({ value, size = 'icon' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await copyToClipboard(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* */ }
  }
  return (
    <Button variant="ghost" size={size} className="size-8 shrink-0" onClick={handleCopy} title="Copiar">
      {copied ? <CheckCheck className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
    </Button>
  )
}

function ReadonlyField({ label, value, mono = false }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className={`flex-1 bg-muted/40 ${mono ? 'font-mono text-sm' : ''}`} />
        <CopyButton value={value} />
      </div>
    </div>
  )
}

// --- Estado 1: sin credenciales ---
function NoCredentials({ onCreate, isCreating }) {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <CardTitle>API Key</CardTitle>
        </div>
        <CardDescription>
          Todavía no tenés credenciales de integración. Generá tu API key para empezar a usar la API B2B.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onCreate} disabled={isCreating} className="w-full">
          {isCreating
            ? <><Loader2 className="size-4 mr-2 animate-spin" />Generando…</>
            : <><Plus className="size-4 mr-2" />Crear API key</>}
        </Button>
      </CardContent>
    </Card>
  )
}

// --- Estado 2: key recién generada (visible una sola vez) ---
function RevealedKey({ apiKeyId, apiKey, onDismiss }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await copyToClipboard(apiKey)
      setCopied(true)
    } catch { /* */ }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3 text-amber-900">
            <TriangleAlert className="size-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Guardá tu API key ahora</p>
              <p className="text-xs leading-relaxed">
                Esta es la única vez que se muestra el valor completo. Una vez que cierres esta sección no podrás volver a verlo. Si la perdés, vas a tener que rotar las credenciales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <CardTitle>Credenciales generadas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReadonlyField label="Key ID" value={apiKeyId} mono />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={apiKey}
                className="flex-1 bg-muted/40 font-mono text-sm"
              />
              <CopyButton value={apiKey} />
            </div>
          </div>

          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full gap-2"
          >
            {copied
              ? <><CheckCheck className="size-4 text-emerald-600" />Copiado al portapapeles</>
              : <><Copy className="size-4" />Copiar API key</>}
          </Button>
        </CardContent>
      </Card>

      <Button
        onClick={onDismiss}
        disabled={!copied}
        className="w-full gap-2"
        title={!copied ? 'Copiá la key antes de continuar' : undefined}
      >
        <ShieldCheck className="size-4" />
        {copied ? 'Ya guardé mi API key' : 'Copiá la key para continuar'}
      </Button>
      {!copied && (
        <p className="text-xs text-center text-muted-foreground">
          El botón se habilita después de copiar la key.
        </p>
      )}
    </div>
  )
}

// --- Estado 3: credenciales existentes ---
function ExistingCredentials({ apiKeyId, createdAt, apiBase, onRotate, isRotating }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const maskedKey = `presti_live_${apiKeyId}${'•'.repeat(32)}`

  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(createdAt))

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              <CardTitle>API Key activa</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={isRotating}
              className="gap-2 text-destructive hover:text-destructive"
            >
              {isRotating
                ? <><Loader2 className="size-4 animate-spin" />Rotando…</>
                : <><RotateCcw className="size-4" />Rotar key</>}
            </Button>
          </div>
          <CardDescription>Creada el {formattedDate}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReadonlyField label="Key ID" value={apiKeyId} mono />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input readOnly value={maskedKey} className="font-mono text-sm bg-muted/40 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ejemplo de uso</CardTitle>
          <CardDescription>Incluí la API key directamente en el header de cada request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evaluar un CUIT</p>
            <pre className="rounded-xl bg-muted p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
{`curl -X POST "${apiBase}/v1/evaluations" \\
  -H "Authorization: Bearer presti_live_${apiKeyId}<tu-secret>" \\
  -H "Content-Type: application/json" \\
  -d '{"cuit": "20123456789"}'`}
            </pre>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consultar resultados</p>
            <pre className="rounded-xl bg-muted p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
{`curl "${apiBase}/v1/evaluations" \\
  -H "Authorization: Bearer presti_live_${apiKeyId}<tu-secret>"`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <AlertDialogRoot open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rotar la API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a generar una nueva key y la actual dejará de funcionar de inmediato. Vas a tener que actualizar todos tus sistemas con la nueva key antes de que expiren los requests en curso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowConfirm(false); onRotate() }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, rotar key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </div>
  )
}

// --- Mock data helpers ---
let mockState = { exists: false, api_key_id: null, created_at: null }

async function mockGet() {
  await new Promise(r => setTimeout(r, 200))
  return mockState.exists
    ? { exists: true, api_key_id: mockState.api_key_id, created_at: mockState.created_at }
    : { exists: false }
}

async function mockPost() {
  await new Promise(r => setTimeout(r, 400))
  const api_key_id = 'a1b2c3d4'
  const api_key = `presti_live_${api_key_id}mock32charssecret000000000000`
  mockState = { exists: true, api_key_id, created_at: new Date().toISOString() }
  return { api_key_id, api_key }
}

// --- Página principal ---
export default function IntegrationsPage() {
  const apiBase = import.meta.env.VITE_SIMULATIONS_API_URL || ''

  // status: 'loading' | 'none' | 'exists' | 'revealed'
  const [status, setStatus]         = useState('loading')
  const [existingKeyId, setExistingKeyId] = useState(null)
  const [existingCreatedAt, setExistingCreatedAt] = useState(null)
  const [revealedKey, setRevealedKey]     = useState(null)   // { api_key_id, api_key }
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError]           = useState('')

  const loadStatus = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = MOCK
        ? await mockGet()
        : await fetch(`${apiBase}/integrations/credentials`, { headers: authHeaders() }).then(r => r.json())

      if (data.exists) {
        setExistingKeyId(data.api_key_id)
        setExistingCreatedAt(data.created_at)
        setStatus('exists')
      } else {
        setStatus('none')
      }
    } catch (e) {
      setError(e.message || 'Error al cargar el estado de las credenciales')
      setStatus('none')
    }
  }

  const createOrRotate = async () => {
    setIsCreating(true)
    setError('')
    try {
      const data = MOCK
        ? await mockPost()
        : await fetch(`${apiBase}/integrations/credentials`, {
            method: 'POST',
            headers: authHeaders(),
          }).then(async r => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}))
              throw new Error(body.error || `Error ${r.status}`)
            }
            return r.json()
          })

      setRevealedKey(data)
      setStatus('revealed')
    } catch (e) {
      setError(e.message || 'Error al generar las credenciales')
    } finally {
      setIsCreating(false)
    }
  }

  const dismissRevealed = () => {
    setExistingKeyId(revealedKey.api_key_id)
    setExistingCreatedAt(new Date().toISOString())
    setRevealedKey(null)
    setStatus('exists')
  }

  useEffect(() => { loadStatus() }, [])

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integración API</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Credenciales para acceder a la API de scoring crediticio desde tus sistemas.
          </p>
        </div>
        {status !== 'revealed' && (
          <Button variant="outline" size="sm" onClick={loadStatus} disabled={status === 'loading'}>
            <RefreshCw className={`size-4 mr-2 ${status === 'loading' ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 max-w-lg">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3 text-red-900">
              <AlertCircle className="size-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Error</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      )}

      {status === 'none' && (
        <NoCredentials onCreate={createOrRotate} isCreating={isCreating} />
      )}

      {status === 'revealed' && revealedKey && (
        <RevealedKey
          apiKeyId={revealedKey.api_key_id}
          apiKey={revealedKey.api_key}
          onDismiss={dismissRevealed}
        />
      )}

      {status === 'exists' && existingKeyId && (
        <ExistingCredentials
          apiKeyId={existingKeyId}
          createdAt={existingCreatedAt}
          apiBase={apiBase}
          onRotate={createOrRotate}
          isRotating={isCreating}
        />
      )}
    </div>
  )
}
