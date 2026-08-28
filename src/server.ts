import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
const port = Number(process.env.PORT ?? 3000);
const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(root, '../public');
const workspace = path.resolve(process.env.WORKSPACE_DIR ?? path.resolve(root, '../workspace'));
const storeFile = path.join(workspace, 'studio.json');

const runSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseModel: z.string().trim().min(1).max(200),
  dataset: z.string().trim().min(1).max(500),
  method: z.enum(['LoRA', 'QLoRA', 'SFT']),
  epochs: z.number().int().min(1).max(100).default(3),
  learningRate: z.number().positive().max(1).default(0.0002)
});

type Run = z.infer<typeof runSchema> & {
  id: string; status: 'queued'|'running'|'completed'|'failed'|'cancelled';
  createdAt: string; startedAt?: string; finishedAt?: string;
  loss?: number; evalScore?: number; throughput?: number; errorMessage?: string;
};
type Store = { version: 1; runs: Run[] };

await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: publicDir, prefix: '/' });

async function loadStore(): Promise<Store> {
  try { return JSON.parse(await readFile(storeFile, 'utf8')) as Store; }
  catch { return { version: 1, runs: [] }; }
}
async function saveStore(store: Store) {
  await mkdir(workspace, { recursive: true });
  const tmp = `${storeFile}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await rename(tmp, storeFile);
}
async function updateRun(id: string, patch: Partial<Run>) {
  const store = await loadStore();
  const run = store.runs.find(r => r.id === id);
  if (!run) return null;
  Object.assign(run, patch);
  await saveStore(store);
  return run;
}

app.get('/health', async (_request, reply) => {
  try {
    await mkdir(workspace, { recursive: true });
    const store = await loadStore();
    return reply.send({ status: 'ok', service: 'fine-tuning-studio', persistence: 'local-file', runs: store.runs.length, time: new Date().toISOString() });
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({ status: 'degraded', service: 'fine-tuning-studio', persistence: 'unavailable' });
  }
});

app.get('/api/analytics', async () => {
  const { runs } = await loadStore();
  const completed = runs.filter(r => r.status === 'completed');
  const values = completed.filter(r => typeof r.evalScore === 'number');
  const losses = completed.filter(r => typeof r.loss === 'number');
  const total = runs.length;
  return {
    totalRuns: total,
    completedRuns: completed.length,
    runningRuns: runs.filter(r => r.status === 'queued' || r.status === 'running').length,
    failedRuns: runs.filter(r => r.status === 'failed').length,
    successRate: total ? Number((completed.length / total * 100).toFixed(1)) : 0,
    averageEvalScore: values.length ? Number((values.reduce((s,r) => s + (r.evalScore ?? 0), 0) / values.length).toFixed(4)) : 0,
    averageLoss: losses.length ? Number((losses.reduce((s,r) => s + (r.loss ?? 0), 0) / losses.length).toFixed(4)) : 0,
    persistence: 'local-file'
  };
});

app.get('/api/runs', async () => (await loadStore()).runs.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100));

app.post('/api/runs', async (request, reply) => {
  const parsed = runSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid training configuration', details: parsed.error.flatten() });
  const run: Run = { ...parsed.data, id: randomUUID(), status: 'queued', createdAt: new Date().toISOString() };
  const store = await loadStore(); store.runs.push(run); await saveStore(store);
  return reply.code(202).send({ ...run, message: 'Run queued. Select a local training runner to execute it.' });
});

app.get('/api/runs/:id', async (request, reply) => {
  const id = String((request.params as { id: string }).id);
  const run = (await loadStore()).runs.find(r => r.id === id);
  return run ? reply.send(run) : reply.code(404).send({ error: 'Run not found' });
});

app.post('/api/runs/:id/cancel', async (request, reply) => {
  const id = String((request.params as { id: string }).id);
  const run = (await loadStore()).runs.find(r => r.id === id);
  if (!run || !['queued','running'].includes(run.status)) return reply.code(404).send({ error: 'Run not found or already finished.' });
  return reply.send(await updateRun(id, { status: 'cancelled', finishedAt: new Date().toISOString() }));
});

app.get('/api/system', async () => ({
  mode: 'self-contained',
  persistence: 'local-file',
  workspace,
  trainingRunner: process.env.TRAINER_COMMAND ? 'configured' : 'not-configured',
  integrations: { github: 'optional', railway: 'optional', huggingFace: Boolean(process.env.HF_TOKEN) ? 'configured' : 'optional' }
}));

app.get('/', async (_request, reply) => reply.sendFile('index.html'));
app.setErrorHandler((error, _request, reply) => { app.log.error(error); reply.code(500).send({ error: 'Internal server error' }); });

try { await mkdir(workspace, { recursive: true }); await app.listen({ port, host: '0.0.0.0' }); }
catch (error) { app.log.error(error); process.exit(1); }
