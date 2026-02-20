PharmaGuard Python VCF Validator

This small Flask service performs structural validation of a VCF file using pysam.

Endpoints

- GET / -> health check
- POST /validate -> validate VCF structure
  - Request JSON: { "vcf_file_path": "/absolute/path/to/file.vcf" }
  - Success response: { "vcf_parsing_success": true }
  - Failure response: { "vcf_parsing_success": false, "message": "Invalid VCF structure or corrupted file." }
  - If header is missing recommended INFO fields, a `warnings` array may be included.

Install & Run (Python 3.8+)

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate    # Windows
source .venv/bin/activate # macOS / Linux
pip install -r requirements.txt
```

2. Run the service:

```bash
python app.py --host 127.0.0.1 --port 8001
```

3. Example request:

```bash
curl -X POST http://127.0.0.1:8001/validate -H "Content-Type: application/json" -d '{"vcf_file_path":"/tmp/uploaded.vcf"}'
```

Notes

- `pysam` may require system packages (samtools/libraries) depending on platform.
- This service intentionally performs structural checks only and returns friendly messages as specified by the PharmaGuard backend integration.
