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
    send(res, 200, { exists: true, api_key_id: 'a1b2c3d4', created_at: new Date(Date.now() - 86_400_000).toISOString() })
    return
  }

  // POST /integrations/credentials
  if (req.method === 'POST' && path === '/integrations/credentials') {
    const api_key_id = 'a1b2c3d4'
    const api_key = `presti_live_${api_key_id}mock32charssecret000000000000`
    send(res, 200, { api_key_id, api_key })
    return
  }

  // GET /simulations/simulate-config
  if (req.method === 'GET' && path === '/simulations/simulate-config') {
    const total_portfolio = 150
    const sim_sit = url.searchParams.get('sim_sit') ? parseInt(url.searchParams.get('sim_sit'), 10) : 2
    const sim_deuda = url.searchParams.get('sim_deuda') ? parseInt(url.searchParams.get('sim_deuda'), 10) : 350000

    let simulated_approved_count = 110
    if (sim_sit < 2) simulated_approved_count -= 30
    if (sim_deuda < 200000) simulated_approved_count -= 40
    if (sim_deuda > 1000000) simulated_approved_count += 20

    const current_approved_count = 95

    const newly_eligible = Math.max(0, simulated_approved_count - current_approved_count)
    const newly_rejected = Math.max(0, current_approved_count - simulated_approved_count)

    send(res, 200, {
      empty: false,
      total_portfolio,
      current_approved_count,
      simulated_approved_count,
      newly_eligible,
      newly_rejected,
      reject_by_situacion: Math.round((total_portfolio - simulated_approved_count) * 0.3),
      reject_by_entidades: Math.round((total_portfolio - simulated_approved_count) * 0.2),
      reject_by_deuda: Math.round((total_portfolio - simulated_approved_count) * 0.25),
      reject_by_meses: Math.round((total_portfolio - simulated_approved_count) * 0.1),
      reject_by_dias: Math.round((total_portfolio - simulated_approved_count) * 0.1),
      reject_by_judicial: Math.round((total_portfolio - simulated_approved_count) * 0.05),
      current_avg_score: 0.625,
      simulated_avg_score: 0.655,
      current_eligible_debt: 12500000,
      simulated_eligible_debt: 14800000,
      avg_entidades: 2.4,
      avg_deuda: 280000,
      avg_meses_sit1: 14,
      count_judicial: 5,
      median_score: 0.58,
      high_score_count: 45,
      mid_score_count: 75,
      low_score_count: 30,
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

