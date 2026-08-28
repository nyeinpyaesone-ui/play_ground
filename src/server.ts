import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Pool } from 'pg';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
const port = Number(process.env.PORT ?? 3000);
const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(root, '../public');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000 }) : null;

type Run = { id: string; name: string; baseModel: string; dataset: string; method: string; status: 'queued'|'running'|'completed'|'failed'; loss: number|null; evalScore: number|null; throughput: number|null; createdAt: string };
const runs: Run[] = [];

await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: publicDir, prefix: '/' });

app.get('/health', async () => ({ status: 'ok', service: 'fine-tuning-studio', database: pool ? 'configured' : 'not-configured', time: new Date().toISOString() }));
app.get('/api/analytics', async () => {
  const completed = runs.filter(r => r.status === 'completed');
  const avgScore = completed.length ? completed.reduce((s,r)=>s+(r.evalScore ?? 0),0)/completed.length : 0;
  const avgLoss = completed.length ? completed.reduce((s,r)=>s+(r.loss ?? 0),0)/completed.length : 0;
  return { totalRuns: runs.length, completedRuns: completed.length, runningRuns: runs.filter(r=>r.status==='running').length, averageEvalScore: Number(avgScore.toFixed(4)), averageLoss: Number(avgLoss.toFixed(4)), successRate: runs.length ? Number((completed.length/runs.length*100).toFixed(1)) : 0 };
});
app.get('/api/runs', async () => runs.slice(-50).reverse());

const runSchema = z.object({ name: z.string().min(1).max(100), baseModel: z.string().min(1).max(200), dataset: z.string().min(1).max(200), method: z.enum(['LoRA','QLoRA','SFT']) });
app.post('/api/runs', async (request, reply) => {
  const parsed = runSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid training configuration', details: parsed.error.flatten() });
  const r: Run = { id: crypto.randomUUID(), ...parsed.data, status: 'queued', loss: null, evalScore: null, throughput: null, createdAt: new Date().toISOString() };
  runs.push(r);
  setTimeout(() => { r.status='running'; }, 250);
  setTimeout(() => { r.status='completed'; r.loss=Number((0.65+Math.random()*0.2).toFixed(4)); r.evalScore=Number((0.70+Math.random()*0.25).toFixed(4)); r.throughput=Math.round(10+Math.random()*30); }, 1500);
  return reply.code(202).send(r);
});

app.get('/', async (_req, reply) => reply.sendFile('index.html'));
app.setErrorHandler((error, _req, reply) => { app.log.error(error); reply.code(500).send({ error: 'Internal server error' }); });

await app.listen({ port, host: '0.0.0.0' });
