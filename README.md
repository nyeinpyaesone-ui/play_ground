# Fine-Tuning Studio

A lightweight, reusable control plane for fine-tuning experiments.

## Design outcome

The project combines the source architecture direction with a leaner production boundary: Railway hosts the control plane; training compute is replaceable. PostgreSQL is optional at bootstrap and becomes the durable metadata store when `DATABASE_URL` is supplied. Redis, Hugging Face, GPU workers, and external training backends can be integrated without coupling the GUI to them.

## Current capabilities

- Responsive operations GUI
- Reusable experiment configuration
- LoRA / QLoRA / SFT method selection
- Training run lifecycle simulation for end-to-end UI validation
- Analytics: run count, completion, success rate, loss, evaluation score, throughput
- Typed Fastify API with validation
- Health/readiness endpoint
- Production Docker image with non-root runtime
- Railway health-check and restart policy

## Production evolution

1. Persist runs, datasets, configs, metrics and artifacts in PostgreSQL.
2. Replace the demo runner with a queue-backed training worker.
3. Add Redis for job state/events and WebSocket/SSE streaming.
4. Add Hugging Face authentication and model/dataset registry adapters.
5. Add evaluation plugins and immutable experiment snapshots.
6. Add GitHub Actions typecheck/build/test and image publishing.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.
