# pharmaAI (PharmaGuard)

PharmaGuard is a hackathon demo: frontend (React + Tailwind) and backend (Node + Express).

Quick start

1. Start backend

```bash
cd backend
npm install
npm run dev
```

2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to `http://localhost:5000` for convenience. The backend currently returns a static mock response in `backend/mock_response.json`. Replace the mock in `routes/analyze.js` with an HTTP call to your Python LLM service at `http://localhost:8000/analyze` when ready.
