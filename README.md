# TokenGate

TokenGate is an LLM cost gateway and token minimizer built using Node.js, Express, TypeScript, PostgreSQL (with pgvector), Prisma ORM, Redis, and a React/Vite frontend.

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
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GEMINI_API_KEY` | Gemini API Key |
| `VITE_API_URL` | Frontend link to Backend URL |
| `ALLOWED_ORIGIN` | Express CORS allowed origin domain |
| `RATE_LIMIT_PER_MINUTE` | Redis rate limit (default 60) |
| `CACHE_TTL_HOURS` | Cache Time-to-Live in hours (default 24) |
| `LOG_LEVEL` | Pino logging level |

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
| GET | `/health` | No | Server health check |
