# Fine-Tuning Studio

A lightweight, reusable, self-contained control system for finite fine-tuning projects.

## Architecture

The application is designed to run locally as the primary mode. GUI, API, experiment metadata and workspace live together in one portable project. Training compute is a replaceable local worker rather than a permanent cloud dependency.

GitHub and Railway are development/deployment conveniences, not required for normal offline/local operation. Hugging Face is an optional model/dataset publishing connector.

## Current capabilities

- Responsive training-operations GUI
- LoRA / QLoRA / SFT configuration
- Durable local experiment state in `WORKSPACE_DIR/studio.json`
- Run lifecycle: queued, running, completed, failed, cancelled
- Honest analytics derived from stored run records
- No synthetic training metrics
- Configuration validation with Zod
- Health endpoint with local persistence verification
- Portable Docker runtime
- Optional external integrations

## Local quick start

```bash
npm ci
npm run dev
```

Or with Docker:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

## Workspace

The `workspace/` directory is intentionally local and ignored by Git. Keep datasets, model/adapters, experiment exports and the durable `studio.json` state there. Back it up when the finite project is complete.

## Training execution boundary

Creating a run only creates a real queued job record. The control plane never fabricates loss, evaluation or throughput. A real training worker must claim and execute the job before those metrics can exist.

This boundary allows the same project to use a local GPU, another local process, or a future external runner without redesigning the GUI.

## Optional integrations

- `HF_TOKEN`: enable a future Hugging Face connector.
- `TRAINER_COMMAND`: reserved for a real local training-worker integration; leave unset until an actual trainer is installed.
- Railway: useful for temporary preview/control-plane deployment, not required for local operation.

## Production principle

**Portable first. Cloud optional. Data stays with the project. No fake results.**
