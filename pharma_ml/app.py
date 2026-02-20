from flask import Flask, request, jsonify
import json
import os
import tempfile
from werkzeug.utils import secure_filename

from pipeline import run_pipeline_multi

app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_LENGTH", str(5 * 1024 * 1024)))

_ALLOWED_EXT = {".vcf"}


def _allowed_filename(filename: str) -> bool:
    _, ext = os.path.splitext((filename or "").lower())
    return ext in _ALLOWED_EXT


def _looks_like_vcf(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(2048)
    except Exception:
        return False

    try:
        text = head.decode("utf-8", errors="ignore")
    except Exception:
        return False

    # Basic VCF structural sanity checks
    if "##fileformat=VCF" not in text:
        return False
    if "#CHROM" not in text:
        return False
    return True


def _parse_drugs_field(raw: str):
    if raw is None:
        return []
    raw = str(raw).strip()
    if not raw:
        return []

    if raw.startswith("["):
        try:
            val = json.loads(raw)
            if isinstance(val, list):
                return [str(x).strip() for x in val if str(x).strip()]
        except Exception:
            pass

    return [s.strip() for s in raw.split(",") if s.strip()]


@app.get("/")
def health_root():
    return jsonify({"status": "ok"}), 200


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.post("/analyze")
def analyze():
    if "vcf_file" not in request.files:
        return jsonify({"status": "error", "message": "No vcf_file part"}), 400

    file = request.files["vcf_file"]
    if not file or not file.filename:
        return jsonify({"status": "error", "message": "No selected file"}), 400

    filename = secure_filename(file.filename)
    if not _allowed_filename(filename):
        return jsonify({"status": "error", "message": "Invalid file extension, .vcf required"}), 400

    patient_id = (request.form.get("patient_id") or "").strip() or None
    drugs = _parse_drugs_field(request.form.get("drugs"))
    if not drugs:
        return jsonify({"status": "error", "message": "Drugs field is required"}), 400

    # LLM reasoning ON by default (can be turned off via enable_llm=false or ENABLE_LLM=false)
    enable_llm_raw = (request.form.get("enable_llm") or os.getenv("ENABLE_LLM") or "true").strip().lower()
    enable_llm = enable_llm_raw in {"1", "true", "yes", "y", "on"}

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="pharmaguard_", suffix=".vcf", delete=False) as tmp:
            tmp_path = tmp.name
            file.save(tmp_path)

        if not _looks_like_vcf(tmp_path):
            return jsonify({"status": "error", "message": "Invalid VCF structure or corrupted file."}), 400

        reports = run_pipeline_multi(tmp_path, drugs, patient_id=patient_id, enable_llm=enable_llm)
        return jsonify({"status": "success", "results": reports}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=False)
