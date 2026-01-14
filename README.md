# WayneAIWrapper

Local relay + worker pair for a lightweight personal assistant loop. The relay
API accepts jobs, and the worker polls, runs deterministic helpers, and (optionally)
calls Ollama for responses.

## What is inside
- apps/relay-api: Fastify API that stores jobs in memory.
- apps/worker: Polling worker that handles tasks and LLM replies.
- shared: Shared utilities (if present).

## Prereqs
- Node.js 18+
- Ollama running locally (optional, only needed for LLM replies)

## Quick start
1) Install deps
   - `npm install`
2) Start the relay API
   - `npm run dev -w apps/relay-api`
3) Start the worker
   - `npm run dev -w apps/worker`

## Environment
Copy the sample `.env.example` files and adjust values as needed:
- `apps/relay-api/.env`
- `apps/worker/.env`

Key vars:
- `RELAY_API_URL`: URL the worker polls (default `http://127.0.0.1:3000`)
- `RELAY_API_KEY`: shared API key for relay auth
- `OLLAMA_URL`: local Ollama API base (default `http://localhost:11434`)
- `OLLAMA_MODEL`: model name (default `qwen2.5:7b`)

## API (relay)
All requests require:
`Authorization: Bearer <RELAY_API_KEY>`

Endpoints:
- `GET /health`
- `POST /jobs` (body: `{ "userId": "...", "message": "..." }`)
- `GET /jobs/next?userId=...`
- `GET /jobs/:id`
- `POST /jobs/:id/complete` (body: `{ "reply": "..." }`)
- `POST /jobs/:id/error` (body: `{ "error": "..." }`)

## Task commands (worker)
The worker has a small deterministic handler for quick updates:
- `add task <text>` adds a line to `apps/worker/memory/daily_tasks.md`

## Notes
- Relay storage is in-memory, so restart clears jobs.
- The worker writes memory files under `apps/worker/memory`.

## Where things run
- relay-api: runs in the cloud (Render).
- worker (Wayne): runs on your local machine (laptop / later Pi).
- mobile app: connects to the relay-api URL with API key.
