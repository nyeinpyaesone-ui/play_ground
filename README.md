# Fine-Tuning Studio

A lightweight, reusable, self-contained project workspace for finite fine-tuning work.

## Product definition

Fine-Tuning Studio is a **project control and analytics application**. Training is optional. The application does not require a permanently running cloud service and does not invent training results.

The primary operating model is:

```text
Create project → Dataset → Configure → Prepare → Optional Execute → Evaluate → Export → Archive
```

## Architecture

The local project contains the GUI, API, configuration, experiment metadata and workspace. The training engine is an adapter boundary: a local GPU process can be attached when actual training is required, but the control application remains useful without a trainer.

GitHub and Railway are development/deployment conveniences. Hugging Face is an optional connector. Normal project work can be performed offline.

## Current capabilities

- Responsive production GUI
- Reusable six-stage workflow: Dataset, Configure, Prepare, Execute, Evaluate, Export
- LoRA / QLoRA / SFT configuration
- Durable local project state in `WORKSPACE_DIR/studio.json`
- Run/stage lifecycle: queued, running, completed, failed, cancelled
- Analytics derived only from stored measured results
- No synthetic loss, evaluation or throughput values
- Validated configuration and measured-result API boundaries
- Health and runtime-mode endpoints
- Portable Docker runtime
- Optional GitHub, Railway and Hugging Face integrations

## Local quick start

```bash
npm ci
npm run dev
```

Or:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

## Project workspace

`workspace/` is intentionally local and ignored by Git. Keep datasets, experiment state, evaluation records, model/adapters and exports there. When the finite project is complete, archive or copy the workspace as the project record.

## Training boundary

Saving an Execute-stage configuration **does not start training**. A real runner may consume the saved configuration later. Only a runner or trusted result-ingestion process may write measured loss, evaluation and throughput values.

This keeps the application useful as a planning, experiment-management and analytics tool while allowing actual fine-tuning to be attached when needed.

## Optional integrations

- `HF_TOKEN`: optional Hugging Face connector configuration.
- `TRAINER_COMMAND`: reserved for a real local training-worker integration; leave unset when training is not required.
- Railway: temporary preview/control-plane deployment only; it is not a permanent runtime requirement.

## Production principle

**Portable first. Self-contained by default. Training optional. Cloud optional. Data stays with the project. No fake results.**
