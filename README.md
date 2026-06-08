# AI Agent Platform — Frontend

Next.js (App Router) UI for the AI Agent Platform: auth, streaming chat with live
tool indicators, and document management. Talks to the FastAPI backend (separate
repo).

Built with **Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui**.

## Structure

```
app/
  layout.tsx         Root layout + AuthProvider
  page.tsx           Redirects to /chat or /login
  login/ signup/     Auth pages
  chat/              Streaming chat UI (sidebar, messages, tool indicators)
  documents/         Upload / list / delete documents
components/
  auth-form.tsx      Shared login/signup form
  app-header.tsx     Nav + logout
  ui/                shadcn/ui components
lib/
  api.ts             fetch wrapper (JWT, error normalization)
  sse.ts             SSE stream parser (pure parseSSEBuffer + streamChat)
  auth.tsx           Auth context (token in localStorage)
  use-require-auth.ts  Route guard hook
```

## Prerequisites

- Node.js 18+
- The backend running at `http://localhost:8000` (see the backend repo)

## Setup

```bash
npm install
copy .env.example .env.local      # default: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                       # http://localhost:3000
```

## Usage

1. Open http://localhost:3000 and sign up.
2. **Documents** → upload a `.txt`/`.md`/`.pdf`.
3. **Chat** → ask a question answerable from that document; watch the
   "Searching your documents" indicator and a streamed, grounded answer. Try a
   math question (calculator) and a current-events question (web search, if
   Tavily is configured on the backend).

## Notes

- The JWT is stored in `localStorage` for v1. For production, prefer an httpOnly cookie.
- `NEXT_PUBLIC_API_URL` is the only required env var; it's not a secret, but
  `.env.local` is gitignored by convention.
