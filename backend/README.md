
To integrate with Python later, set `PYTHON_BACKEND_URL` in your environment (see `.env.example`). The backend will forward a payload to that URL and return the Python service's JSON response.

Forwarding behavior:

- `PYTHON_BACKEND_URL`: full URL to POST the analysis payload (e.g. `http://localhost:8000/analyze`)
- `FORWARD_TIMEOUT_MS`: per-request timeout in milliseconds (default 10000)
- `FORWARD_RETRIES`: number of retries on failure (default 2)

If forwarding fails the server falls back to the local mock response in `mock_response.json`.

Simple Express API that exposes `POST /api/analyze`.

Features:

- Accepts `multipart/form-data` with `vcf_file` and `drugs` (comma-separated)
- Validates `.vcf` extension and max file size 5 MB
- Returns a static mock JSON response from `mock_response.json` (placeholder for Python LLM service)

Run:

```bash
cd backend
npm install
npm run dev
```

To integrate with Python later, replace the mock read in `routes/analyze.js` with an HTTP POST to your Python service.
