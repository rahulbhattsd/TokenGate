
# TokenGate

TokenGate is an LLM cost gateway and token minimizer built using Node.js, Express, TypeScript, PostgreSQL (with pgvector), Prisma ORM, Redis, and a React/Vite frontend. It supports multi-provider chat routing, semantic caching, token pruning, usage analytics, and optional retrieval-augmented generation (RAG) inside the existing `/v1/chat/completions` gateway.
<img width="1273" height="1236" alt="token" src="https://github.com/user-attachments/assets/cb1b4520-67c0-435f-96d4-1967050f095f" />
## Setup Instructions

1. **Clone the repository:**
   `git clone <repo_url>`
   `cd TokenGate`

2. **Database Setup:**
   Ensure you have PostgreSQL running with the `vector` extension installed.
   Set up your `DATABASE_URL` in your environment.

3. **Redis Setup:**
   Ensure Redis is installed and running locally, or configure `REDIS_URL`.

4. **Install Dependencies:**
   `cd server && npm install`
   `cd ../client && npm install`

5. **Run Prisma Migrations:**
   `cd server && npx prisma generate && npx prisma migrate deploy`

6. **Start the Application:**
   `cd server && npm run dev`
   `cd client && npm run dev`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL database connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `CACHE_SIMILARITY_THRESHOLD` | Semantic search threshold (default 0.95) |
| `OPENAI_API_KEY` | OpenAI API Key (Required for semantic caching even if using other providers for completion) |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GEMINI_API_KEY` | Gemini API Key |
| `VITE_API_URL` | Frontend link to Backend URL |
| `ALLOWED_ORIGIN` | Express CORS allowed origin domain |
| `RATE_LIMIT_PER_MINUTE` | Redis rate limit (default 60) |
| `CACHE_TTL_HOURS` | Cache Time-to-Live in hours (default 24) |
| `LOG_LEVEL` | Pino logging level |
| `RAG_EMBEDDING_MODEL` | Embedding model for semantic cache and RAG (default `text-embedding-3-small`) |
| `RAG_EMBEDDING_COST_PER_1M_TOKENS` | Embedding cost used for analytics (default `0.02`) |
| `RAG_CHUNK_SIZE` | Token target for document chunks (default 500) |
| `RAG_CHUNK_OVERLAP` | Token overlap between adjacent chunks (default 75) |
| `RAG_TOP_K` | Default retrieval result count (default 5) |
| `RAG_SIMILARITY_THRESHOLD` | Default retrieval similarity threshold (default 0.75) |
| `RAG_MAX_CONTEXT_TOKENS` | Default RAG context budget (default 2000) |
| `RAG_REQUIRE_CONTEXT` | If `true`, RAG requests skip the LLM when no context is found |
| `RAG_MAX_FILE_BYTES` | Maximum uploaded document size in bytes (default 10485760) |

## API Endpoints

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| POST | `/auth/signup` | No | Create user account |
| POST | `/auth/login` | No | Login to get tokens |
| POST | `/auth/refresh` | No (requires refresh token) | Refresh access token |
| GET | `/keys` | Yes (JWT) | List API keys |
| POST | `/keys` | Yes (JWT) | Generate a new API key |
| DELETE | `/keys/:id` | Yes (JWT) | Revoke an API key |
| GET | `/analytics/summary` | Yes (JWT) | Get cost and request summary |
| GET | `/analytics/cost-trend` | Yes (JWT) | Get daily cost trends |
| GET | `/analytics/by-model` | Yes (JWT) | Cost breakdown by model |
| GET | `/analytics/logs` | Yes (JWT) | Request logs history |
| POST | `/v1/chat/completions` | Yes (API Key) | Proxy chat to Provider |
| GET | `/api/knowledge-bases` | Yes (JWT) | List knowledge bases |
| POST | `/api/knowledge-bases` | Yes (JWT) | Create a knowledge base |
| GET | `/api/knowledge-bases/:id` | Yes (JWT) | Get a knowledge base and documents |
| PATCH | `/api/knowledge-bases/:id` | Yes (JWT) | Update a knowledge base |
| DELETE | `/api/knowledge-bases/:id` | Yes (JWT) | Delete a knowledge base |
| POST | `/api/knowledge-bases/:id/documents` | Yes (JWT) | Upload and index a document |
| GET | `/api/knowledge-bases/:id/documents` | Yes (JWT) | List documents |
| GET | `/api/knowledge-bases/:id/documents/:documentId` | Yes (JWT) | Get document metadata |
| DELETE | `/api/knowledge-bases/:id/documents/:documentId` | Yes (JWT) | Delete a document |
| POST | `/api/knowledge-bases/:id/search` | Yes (JWT) | Test retrieval |
| GET | `/health` | No | Server health check |

## Optional RAG Gateway Usage

Normal gateway requests continue to work without RAG:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

To enable RAG, pass a `rag` object. The API key owner must own the knowledge base:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "What is our refund policy?" }],
  "rag": {
    "enabled": true,
    "knowledgeBaseId": "kb-id",
    "topK": 5,
    "similarityThreshold": 0.75,
    "maxContextTokens": 2000
  }
}
```

RAG responses include source metadata under `rag.sources`. Semantic cache entries for RAG requests are scoped by provider, model, knowledge base ID, knowledge base version, and retrieval settings so document changes invalidate older RAG cache answers.

## Document Ingestion

The knowledge-base upload endpoint accepts `.txt`, `.md`, `.json`, `.csv`, and `.pdf` files. Uploaded content is validated, normalized, chunked by token budget, embedded in batches, and stored in PostgreSQL using pgvector. Knowledge-base versions increment when documents are added, deleted, or knowledge-base metadata is updated.
