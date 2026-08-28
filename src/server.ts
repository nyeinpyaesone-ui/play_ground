import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Pool } from 'pg';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
const port = Number(process.env.PORT ?? 3000);
const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(root, '../public');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 5), idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }) : null;

const runSchema = z.object({ name: z.string().trim().min(1).max(100), baseModel: z.string().trim().min(1).max(200), dataset: z.string().trim().min(1).max(200), method: z.enum(['LoRA','QLoRA','SFT']) });
await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: publicDir, prefix: '/' });

async function ensureDatabase() {
  if (!pool) return;
  const schema = await readFile(path.resolve(root, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

app.get('/health', async (_request, reply) => {
  let database: 'connected'|'not-configured'|'unavailable' = 'not-configured';
  if (pool) { try { await pool.query('SELECT 1'); database = 'connected'; } catch { database = 'unavailable'; } }
  return reply.code(database === 'unavailable' ? 503 : 200).send({ status: database === 'unavailable' ? 'degraded' : 'ok', service: 'fine-tuning-studio', database, time: new Date().toISOString() });
});

app.get('/api/analytics', async (_request, reply) => {
  if (!pool) return { totalRuns: 0, completedRuns: 0, runningRuns: 0, averageEvalScore: 0, averageLoss: 0, successRate: 0, persistence: 'disabled' };
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total_runs, COUNT(*) FILTER (WHERE status='completed')::int AS completed_runs, COUNT(*) FILTER (WHERE status IN ('queued','running'))::int AS running_runs, ROUND(AVG(eval_score) FILTER (WHERE status='completed')::numeric,4)::float AS average_eval_score, ROUND(AVG(loss) FILTER (WHERE status='completed')::numeric,4)::float AS average_loss FROM training_runs`);
  const r = rows[0];
  return { totalRuns: r.total_runs, completedRuns: r.completed_runs, runningRuns: r.running_runs, averageEvalScore: r.average_eval_score ?? 0, averageLoss: r.average_loss ?? 0, successRate: r.total_runs ? Number((r.completed_runs / r.total_runs * 100).toFixed(1)) : 0, persistence: 'postgresql' };
});

app.get('/api/runs', async (_request, reply) => {
  if (!pool) return [];
  const { rows } = await pool.query(`SELECT id,name,base_model AS "baseModel",dataset,method,status,loss,eval_score AS "evalScore",throughput,created_at AS "createdAt",started_at AS "startedAt",finished_at AS "finishedAt",error_message AS "errorMessage" FROM training_runs ORDER BY created_at DESC LIMIT 100`);
  return reply.send(rows);
});

app.post('/api/runs', async (request, reply) => {
  const parsed = runSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid training configuration', details: parsed.error.flatten() });
  if (!pool) return reply.code(503).send({ error: 'Persistence is not configured. Attach PostgreSQL and provide DATABASE_URL before creating runs.' });
  const id = crypto.randomUUID();
  const { name, baseModel, dataset, method } = parsed.data;
  const { rows } = await pool.query(`INSERT INTO training_runs (id,name,base_model,dataset,method) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,base_model AS "baseModel",dataset,method,status,created_at AS "createdAt"`, [id,name,baseModel,dataset,method]);
  return reply.code(202).send({ ...rows[0], message: 'Run queued. A compatible training worker must claim the job.' });
});

app.post('/api/runs/:id/cancel', async (request, reply) => {
  if (!pool) return reply.code(503).send({ error: 'Persistence is not configured.' });
  const id = String((request.params as { id: string }).id);
  const { rowCount } = await pool.query(`UPDATE training_runs SET status='cancelled',finished_at=NOW() WHERE id=$1 AND status IN ('queued','running')`, [id]);
  if (!rowCount) return reply.code(404).send({ error: 'Run not found or already finished.' });
  return { id, status: 'cancelled' };
});

app.get('/', async (_req, reply) => reply.sendFile('index.html'));
app.setErrorHandler((error, _req, reply) => { app.log.error(error); reply.code(500).send({ error: 'Internal server error' }); });

try { await ensureDatabase(); await app.listen({ port, host: '0.0.0.0' }); }
catch (error) { app.log.error(error); process.exit(1); }
