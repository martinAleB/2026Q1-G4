import { createServer } from 'http'
import { randomUUID } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
}

// --- Simulations ---

const simulations = [
  { task_id: randomUUID(), cuit: '20304050607', status: 'COMPLETED', score: 0.821, created_at: new Date(Date.now() - 3_600_000).toISOString() },
  { task_id: randomUUID(), cuit: '27123456789', status: 'COMPLETED', score: 0.432, created_at: new Date(Date.now() - 7_200_000).toISOString() },
  { task_id: randomUUID(), cuit: '30987654321', status: 'ERROR',     score: null,  created_at: new Date(Date.now() - 86_400_000).toISOString() },
]

// --- Productos ---

const MOCK_SUB = 'mock-sub-123'

const productos = [
  { producto_id: randomUUID(), sub: MOCK_SUB, nombre: 'Préstamo Personal Plus',  monto: 500000, cuotas: 24, interes: 45, min_score: 4.5, max_score: 8.5 },
  { producto_id: randomUUID(), sub: MOCK_SUB, nombre: 'Microcrédito Express',    monto:  80000, cuotas:  6, interes: 65, min_score: 2.0, max_score: 5.5 },
  { producto_id: randomUUID(), sub: MOCK_SUB, nombre: 'Tarjeta Capital Pyme',    monto: 750000, cuotas: 12, interes: 55, min_score: 4.5, max_score: 8.5 },
]

// --- Helpers ---

function readBody(req) {
  return new Promise(resolve => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => { resolve(JSON.parse(body || '{}')) })
  })
}

function send(res, status, data) {
  res.writeHead(status, CORS)
  res.end(JSON.stringify(data))
}

// --- Server ---

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS)
    res.end()
    return
  }

  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  // GET /simulations
  if (req.method === 'GET' && path === '/simulations') {
    send(res, 200, { results: simulations })
    return
  }

  // POST /simulations
  if (req.method === 'POST' && path === '/simulations') {
    const { cuit } = await readBody(req)
    const task_id = randomUUID()
    const sim = { task_id, cuit, status: 'PENDING', score: null, created_at: new Date().toISOString() }
    simulations.unshift(sim)
    send(res, 201, { task_id })
    setTimeout(() => {
      sim.status = 'COMPLETED'
      sim.score = parseFloat((Math.random() * 0.9 + 0.1).toFixed(3))
    }, 3000)
    return
  }

  // GET /producto
  if (req.method === 'GET' && path === '/producto') {
    send(res, 200, productos)
    return
  }

  // POST /producto
  if (req.method === 'POST' && path === '/producto') {
    const body = await readBody(req)
    const item = { producto_id: randomUUID(), sub: MOCK_SUB, ...body }
    productos.unshift(item)
    send(res, 201, item)
    return
  }

  // PUT /producto/:id
  const putMatch = path.match(/^\/producto\/(.+)$/)
  if (req.method === 'PUT' && putMatch) {
    const id = putMatch[1]
    const body = await readBody(req)
    const idx = productos.findIndex(p => p.producto_id === id)
    if (idx === -1) { send(res, 404, { error: 'Not found' }); return }
    productos[idx] = { ...productos[idx], ...body }
    send(res, 200, productos[idx])
    return
  }

  // DELETE /producto/:id
  const deleteMatch = path.match(/^\/producto\/(.+)$/)
  if (req.method === 'DELETE' && deleteMatch) {
    const id = deleteMatch[1]
    const idx = productos.findIndex(p => p.producto_id === id)
    if (idx === -1) { send(res, 404, { error: 'Not found' }); return }
    productos.splice(idx, 1)
    send(res, 200, { message: 'Producto deleted successfully' })
    return
  }


  // GET /integrations/credentials
  if (req.method === 'GET' && path === '/integrations/credentials') {
    send(res, 200, {
      client_id: 'mock-client-id-1234567890',
      client_secret: 'mock-client-secret-abcdef1234567890',
      client_name: 'Mock Fintech App',
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
    return
  }

  // POST /portfolio/refresh (mock del portfolio-updater)
  if (req.method === 'POST' && path === '/portfolio/refresh') {
    // Simular el tiempo de procesamiento del BCRA (~2s en mock)
    await new Promise(resolve => setTimeout(resolve, 2000))
    send(res, 200, { statusCode: 200, body: 'OK' })
    return
  }

  send(res, 404, { error: 'Not found' })
}).listen(3001, () => console.log('[mock] servidor en http://localhost:3001'))

