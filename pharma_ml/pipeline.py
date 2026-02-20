"""
pipeline.py
===========
End-to-end pharmacogenomics pipeline orchestrator.

Wires together:
    1. vcf_to_table.py         — VCF parsing  (parse_pgx_vcf, json_to_dataframe)
    2. phenotype_calculator.py — Diplotype + phenotype annotation
    3. detected_variants.py    — Variant-level detail extraction
    4. drug_risk_map.py        — CPIC drug risk lookup

Single drug:
    python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE
    python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE PATIENT_001

Multiple drugs (VCF parsed ONCE, one report per drug):
    python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE WARFARIN SIMVASTATIN
    python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE WARFARIN SIMVASTATIN --patient PATIENT_001

Supported drugs: AZATHIOPRINE, CLOPIDOGREL, CODEINE, FLUOROURACIL, SIMVASTATIN, WARFARIN
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

# ── Module imports ────────────────────────────────────────────────────────────
from vcf_to_table import parse_pgx_vcf, json_to_dataframe
from phenotype_calculator import (
    compute_diplotype,
    annotate_diplotype_phenotype,
    get_activity_score,
)
from detected_variants import generate_detected_variants
from drug_risk_map import get_drug_risk
from risk_scoring import compute_risk_score, compute_missing_data_penalty

# Output directory — created automatically on first run.
_OUTPUT_DIR = Path(__file__).parent / "Output"

# Gene → drug mapping used to select the right gene for a given drug.
# Only genes in CPIC_DRUG_RISK_MAP are listed here.
_DRUG_TO_GENE: dict[str, str] = {
    "CODEINE":      "CYP2D6",
    "CLOPIDOGREL":  "CYP2C19",
    "WARFARIN":     "CYP2C9",
    "SIMVASTATIN":  "SLCO1B1",
    "AZATHIOPRINE": "TPMT",
    "FLUOROURACIL": "DPYD",
    "5-FU":         "DPYD",
}

# Genes that require CNV data to be fully characterised (SNP VCF insufficient).
_GENES_NEED_CNV: set[str] = {"CYP2D6"}

# DOI / URL lookup for each CPIC guideline (for supporting_citation block).
_CPIC_CITATION_URLS: dict[str, str] = {
    "CYP2D6":  "https://cpicpgx.org/guidelines/cpic-guideline-for-codeine/",
    "CYP2C19": "https://cpicpgx.org/guidelines/cpic-guideline-for-clopidogrel/",
    "CYP2C9":  "https://cpicpgx.org/guidelines/cpic-guideline-for-warfarin/",
    "SLCO1B1": "https://cpicpgx.org/guidelines/cpic-guideline-for-statins/",
    "TPMT":    "https://cpicpgx.org/guidelines/cpic-guideline-for-azathioprine-and-thioguanine/",
    "DPYD":    "https://cpicpgx.org/guidelines/cpic-guideline-for-fluoropyrimidines-and-dpyd/",
}


def _map_risk_label(label: str) -> str:
    """Map internal CPIC-derived risk labels to the simplified output vocabulary."""
    label = (label or "").strip()
    if label == "Safe":
        return "Safe"
    if label in {"Adjust Dose", "Reduced Efficacy"}:
        return "Adjust Dosage"
    if label in {"Avoid", "Contraindicated"}:
        return "Toxic"
    return "Unknown"


def _severity_from_risk_category(risk_category: str) -> str:
    """Map risk_scoring category to the output severity vocabulary."""
    risk_category = (risk_category or "").strip().lower()
    if risk_category == "minimal":
        return "none"
    if risk_category in {"low", "moderate", "high", "critical"}:
        return risk_category
    return "none"


def _build_clinical_recommendation_text(
    *,
    drug: str,
    gene: str,
    diplotype: str,
    phenotype: str,
    activity_score: float | None,
    action: str,
    severity: str,
    confidence_score: float,
    evidence_level: str,
    cpic_recommendation: str,
    data_quality_notes: str | None,
    flags: list[str],
    cpic_guideline_version: str | None,
    cpic_doi: str | None,
    cpic_url: str | None,
) -> str:
    parts: list[str] = []

    geno_summary = f"{gene} diplotype {diplotype} → phenotype {phenotype}"
    parts.append(f"PGx summary: {drug} / {geno_summary}.")

    if activity_score is not None:
        parts.append(f"Activity score: {activity_score}.")

    parts.append(
        "Guideline-based recommendation: "
        + (cpic_recommendation.strip().rstrip(".") + "." if cpic_recommendation else "Not available.")
    )

    parts.append(
        f"Clinical action: {action}. Severity: {severity}. "
        f"Evidence level: {evidence_level}. Confidence: {confidence_score:.2f}."
    )

    monitoring_bits: list[str] = []
    if action == "Adjust Dosage":
        monitoring_bits.append("monitor clinical response and adverse effects")
    if action == "Toxic":
        monitoring_bits.append("use an alternative therapy and monitor closely if no alternatives")
    if action == "Safe":
        monitoring_bits.append("routine monitoring per standard of care")
    if monitoring_bits:
        parts.append("Monitoring: " + "; ".join(monitoring_bits).rstrip(";") + ".")

    if data_quality_notes:
        parts.append("Data limitations: " + data_quality_notes.strip().rstrip(".") + ".")

    if "missing_cnv" in (flags or []):
        parts.append("Follow-up: consider CYP2D6 copy-number (CNV) testing to refine phenotype and action.")
    if "no_phase" in (flags or []):
        parts.append("Follow-up: consider phased genotyping/haplotype resolution if available.")
    if "HapB3_proxy_only" in (flags or []):
        parts.append("Follow-up: confirm causal DPYD variant (rs75017182) if clinically relevant.")

    citation_bits: list[str] = []
    if cpic_guideline_version:
        citation_bits.append(f"version {cpic_guideline_version}")
    if cpic_doi:
        citation_bits.append(f"DOI:{cpic_doi}")
    if cpic_url:
        citation_bits.append(str(cpic_url))
    if citation_bits:
        parts.append("CPIC guideline citation: " + " | ".join(citation_bits) + ".")

    return " ".join(parts)


def _load_dotenv_if_present(env_path: Path | None = None) -> None:
    """Load KEY=VALUE pairs from a local .env file into os.environ (if not already set)."""
    env_path = env_path or (Path(__file__).parent / ".env")
    if not env_path.exists():
        return

    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception:
        return


def _groq_chat_completion(*, api_key: str, model: str, messages: list[dict[str, str]], timeout_s: float = 30.0) -> dict[str, Any]:
    """Call Groq's OpenAI-compatible Chat Completions endpoint."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 600,
        "response_format": {"type": "json_object"},
    }

    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=timeout_s) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except URLError as e:
        raise RuntimeError(f"Groq API request failed: {e}")


def _groq_chat_completion_via_sdk(
    *,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    stream: bool,
) -> str:
    """Call Groq using the official Python SDK and return the assistant content."""
    try:
        from groq import Groq  # type: ignore
    except Exception as e:
        raise RuntimeError(f"Groq SDK not installed: {e}")

    client = Groq(api_key=api_key)

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        top_p=1,
        stream=stream,
        response_format={"type": "json_object"},
        max_completion_tokens=800,
    )

    if not stream:
        return completion.choices[0].message.content or ""

    chunks: list[str] = []
    for chunk in completion:
        delta = getattr(chunk.choices[0], "delta", None)
        if delta is None:
            continue
        piece = getattr(delta, "content", None)
        if piece:
            chunks.append(piece)
    return "".join(chunks)


def _generate_llm_explanation(report: dict[str, Any]) -> dict[str, Any]:
    """Generate an LLM explanation grounded strictly in the computed report."""
    _load_dotenv_if_present()
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"error": "GROQ_API_KEY not set"}

    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    drug = str(report.get("drug", ""))
    patient_id = str(report.get("patient_id", ""))
    ra = report.get("risk_assessment", {}) or {}
    pgx = report.get("pharmacogenomic_profile", {}) or {}
    cr = report.get("clinical_recommendation", {}) or {}

    grounded_input = {
        "patient_id": patient_id,
        "drug": drug,
        "risk_assessment": {
            "risk_label": ra.get("risk_label"),
            "confidence_score": ra.get("confidence_score"),
            "severity": ra.get("severity"),
        },
        "pharmacogenomic_profile": {
            "primary_gene": pgx.get("primary_gene"),
            "diplotype": pgx.get("diplotype"),
            "phenotype": pgx.get("phenotype"),
            "activity_score": pgx.get("activity_score"),
            "flags": pgx.get("flags"),
            "notes": pgx.get("notes"),
        },
        "clinical_recommendation": {
            "action": cr.get("action"),
            "cpic_guideline": cr.get("cpic_guideline"),
            "data_quality_notes": cr.get("data_quality_notes"),
        },
    }

    system = (
        "You are a clinical pharmacogenomics assistant. "
        "Only use the provided JSON input; do not add new medical facts. "
        "Return ONLY valid JSON."
    )
    user = (
        "Generate llm_generated_explanation as JSON with keys: "
        "summary, clinician_summary, limitations, recommended_next_steps. "
        "Be concise, clinically oriented, and explicitly mention uncertainties from flags/notes. "
        "INPUT_JSON:\n" + json.dumps(grounded_input, ensure_ascii=False)
    )

    try:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        # Prefer Groq Python SDK if available (matches Groq docs/examples).
        try:
            content = _groq_chat_completion_via_sdk(
                api_key=api_key,
                model=model,
                messages=messages,
                stream=True,
            )
        except Exception:
            resp = _groq_chat_completion(
                api_key=api_key,
                model=model,
                messages=messages,
            )
            content = (
                (((resp.get("choices") or [{}])[0]).get("message") or {}).get("content")
                if isinstance(resp, dict)
                else None
            )

        if not content:
            return {"error": "Groq returned empty content"}
        parsed = json.loads(content)
        return parsed
    except Exception as e:
        msg = str(e)
        if "HTTP Error 401" in msg:
            msg += " (Unauthorized: check GROQ_API_KEY)"
        if "HTTP Error 403" in msg:
            msg += " (Forbidden: key may not have access to this model or request; try listing available models or switch GROQ_MODEL)"
        return {"error": msg}


def _finalize_report_for_output(report: dict[str, Any]) -> dict[str, Any]:
    """Remove internal-only keys/fields so saved JSON matches the requested schema."""
    pgx = report.get("pharmacogenomic_profile")
    if isinstance(pgx, dict):
        pgx.pop("flags", None)
        pgx.pop("notes", None)
        pgx.pop("activity_score", None)
    return report




# ── Shared VCF parsing helper ─────────────────────────────────────────────────

def _parse_vcf_once(
    vcf_path: Path,
    patient_id: str,
    timestamp: str,
    drug_key: str,
) -> tuple[bool, "pd.DataFrame", list[dict], int, int]:
    """Parse the VCF and compute diplotypes/phenotypes once.

    Returns:
        (vcf_ok, result_df, detected_variants, total_variants, genes_covered)
    On failure returns (False, empty_df, [], 0, 0).
    """
    import pandas as pd

    try:
        variants_raw = parse_pgx_vcf(vcf_path)
    except Exception:
        return False, pd.DataFrame(), [], 0, 0

    total_variants = sum(len(v) for v in variants_raw.values())
    genes_covered  = len(variants_raw)

    df        = json_to_dataframe(variants_raw)
    result_df = compute_diplotype(df)
    result_df = annotate_diplotype_phenotype(result_df)

    detected: list[dict] = []
    try:
        detected = generate_detected_variants(result_df)
    except Exception:
        pass

    return True, result_df, detected, total_variants, genes_covered


# ── Core pipeline function ────────────────────────────────────────────────────
def run_pipeline(
    vcf_path: str | Path,
    drug: str,
    patient_id: str | None = None,
    enable_llm: bool = False,
) -> dict[str, Any]:
    """Run the full pharmacogenomics pipeline for a single drug.

    Args:
        vcf_path:   Path to the VCF file.
        drug:       Drug name, e.g. "SIMVASTATIN" (case-insensitive).
        patient_id: Optional patient identifier. Defaults to VCF filename stem.

    Returns:
        dict matching the full JSON report schema.
    """
    vcf_path   = Path(vcf_path)
    drug_key   = drug.strip().upper()
    timestamp  = datetime.now(timezone.utc).isoformat()
    patient_id = patient_id or vcf_path.stem

    primary_gene = _DRUG_TO_GENE.get(drug_key)
    if primary_gene is None:
        return _finalize_report_for_output(_error_report(
            patient_id, drug_key, timestamp,
            f"Drug '{drug_key}' is not in the CPIC drug-gene map. "
            f"Supported drugs: {', '.join(sorted(_DRUG_TO_GENE))}.",
        ))

    vcf_ok, result_df, detected, total_variants, genes_covered = _parse_vcf_once(
        vcf_path, patient_id, timestamp, drug_key
    )
    if not vcf_ok:
        return _finalize_report_for_output(_error_report(patient_id, drug_key, timestamp, "VCF parsing failed."))

    report = _build_report(
        patient_id, drug_key, timestamp, primary_gene,
        result_df, detected, total_variants, genes_covered, vcf_ok,
    )
    if enable_llm:
        # Ensure llm_generated_explanation appears before quality_metrics in JSON output.
        qm = report.pop("quality_metrics", None)
        report["llm_generated_explanation"] = _generate_llm_explanation(report)
        if qm is not None:
            report["quality_metrics"] = qm
    return _finalize_report_for_output(report)


def run_pipeline_multi(
    vcf_path: str | Path,
    drugs: list[str],
    patient_id: str | None = None,
    enable_llm: bool = False,
) -> list[dict[str, Any]]:
    """Run the pipeline for multiple drugs, parsing the VCF only once.

    Args:
        vcf_path:   Path to the VCF file.
        drugs:      List of drug names, e.g. ["CODEINE", "WARFARIN"].
        patient_id: Optional patient identifier. Defaults to VCF filename stem.

    Returns:
        List of report dicts, one per drug (same order as input).
    """
    vcf_path   = Path(vcf_path)
    timestamp  = datetime.now(timezone.utc).isoformat()
    patient_id = patient_id or vcf_path.stem

    # ── Parse VCF once ───────────────────────────────────────────────────────
    vcf_ok, result_df, detected, total_variants, genes_covered = _parse_vcf_once(
        vcf_path, patient_id, timestamp, ""
    )

    reports: list[dict[str, Any]] = []
    for drug in drugs:
        drug_key     = drug.strip().upper()
        primary_gene = _DRUG_TO_GENE.get(drug_key)

        if primary_gene is None:
            reports.append(_finalize_report_for_output(_error_report(
                patient_id, drug_key, timestamp,
                f"Drug '{drug_key}' is not in the CPIC drug-gene map. "
                f"Supported drugs: {', '.join(sorted(_DRUG_TO_GENE))}.",
            )))
            continue

        if not vcf_ok:
            reports.append(_finalize_report_for_output(_error_report(patient_id, drug_key, timestamp, "VCF parsing failed.")))
            continue

        report = _build_report(
            patient_id, drug_key, timestamp, primary_gene,
            result_df, detected, total_variants, genes_covered, vcf_ok,
        )
        if enable_llm:
            # Ensure llm_generated_explanation appears before quality_metrics in JSON output.
            qm = report.pop("quality_metrics", None)
            report["llm_generated_explanation"] = _generate_llm_explanation(report)
            if qm is not None:
                report["quality_metrics"] = qm
        reports.append(_finalize_report_for_output(report))

    return reports


def _compute_flags(
    gene: str,
    diplotype: str,
    phenotype: str,
    diplotype_note: str | None,
) -> list[str]:
    """Return structured flag strings for uncertainty and data-quality issues.

    Flag names match the penalty_map keys in risk_scoring.py so that
    compute_risk_score() automatically applies the correct penalty.
    """
    flags: list[str] = []

    # CNV not detectable from a SNP-only VCF (CYP2D6 needs copy-number calls)
    if gene.upper() in _GENES_NEED_CNV:
        flags.append("missing_cnv")

    # Unphased diplotype — heterozygous for 2+ non-ref alleles, trans assumed
    if diplotype_note and "Unphased" in diplotype_note:
        flags.append("no_phase")

    # HapB3 called from proxy SNP only (DPYD; causal SNP rs75017182 not confirmed)
    if diplotype_note and "proxy" in diplotype_note.lower():
        flags.append("HapB3_proxy_only")

    # Star allele not in CPIC activity table → phenotype set to Unknown
    if phenotype == "Unknown":
        flags.append("unknown_star")

    return flags


def _build_citation(cpic_version_str: str, gene: str) -> dict[str, str | None]:
    """Parse the cpic_version string and return a structured citation dict.

    Expects strings like: "CPIC 2020 (DOI:10.1002/cpt.1680)"
    """
    import re
    doi_match = re.search(r"DOI:([^)]+)", cpic_version_str)
    year_match = re.search(r"CPIC (\d{4})", cpic_version_str)

    doi     = doi_match.group(1).strip() if doi_match else None
    version = year_match.group(1) if year_match else cpic_version_str
    url     = _CPIC_CITATION_URLS.get(gene.upper())

    return {
        "source":            "CPIC",
        "guideline_version": version,
        "doi":               doi,
        "url":               url,
    }


def _build_report(
    patient_id: str,
    drug_key: str,
    timestamp: str,
    primary_gene: str,
    result_df: "pd.DataFrame",
    detected_variants: list[dict],
    total_variants: int,
    genes_covered: int,
    vcf_ok: bool,
    patient_context: dict | None = None,
) -> dict[str, Any]:
    """Assemble the full enriched report dict from pre-computed VCF data."""
    # ── Diplotype + phenotype for this gene ────────────────────────────────────
    diplotype      = "*1/*1"
    phenotype      = "Unknown"
    diplotype_note: str | None = None

    gene_rows = result_df[result_df["Gene"].str.upper() == primary_gene.upper()]
    if not gene_rows.empty:
        first          = gene_rows.iloc[0]
        diplotype      = str(first.get("Diplotype", "*1/*1") or "*1/*1")
        phenotype      = str(first.get("Phenotype", "Unknown") or "Unknown")
        note_val = first.get("Diplotype_Note")
        if note_val is None:
            diplotype_note = None
        else:
            import pandas as pd

            diplotype_note = None if pd.isna(note_val) else str(note_val)

    # ── Activity score (CYP2D6 and DPYD only) ────────────────────────────────
    activity_score: float | None = get_activity_score(primary_gene, diplotype)

    # ── Flags ───────────────────────────────────────────────────────────────
    flags = _compute_flags(primary_gene, diplotype, phenotype, diplotype_note)

    # ── Drug risk lookup ──────────────────────────────────────────────────────
    risk = get_drug_risk(primary_gene, phenotype, drug_key)

    # ── Risk score (4-component deterministic formula) ──────────────────────────
    #   raw = severity_weight × evidence_confidence × phenotype_factor × context_multiplier
    #   risk_score = clamp(raw × (1 − missing_data_penalty), 0.0, 1.0)
    score_result = compute_risk_score(
        severity       = risk["severity"],
        evidence_level = risk["evidence_level"],
        phenotype      = phenotype,
        flags          = flags,
        patient_context= patient_context,
    )
    risk_category      = score_result["category"]
    context_notes      = score_result["context_notes"]

    missing_penalty = compute_missing_data_penalty(flags)
    adjusted_confidence = max(0.0, min(1.0, float(risk["confidence_score"]) * (1.0 - missing_penalty)))

    # ── Manual review trigger ───────────────────────────────────────────────────
    require_manual_review = (
        risk["risk_label"] in {"Contraindicated", "Unknown"}
        or bool(flags)
        or risk_category in {"critical", "high"}
    )

    # ── Notes (human-readable uncertainty summary) ────────────────────────────
    note_parts: list[str] = []
    if "missing_cnv" in flags:
        note_parts.append(
            "CYP2D6 copy number not assessed (SNP-only VCF). "
            "CNV can change effective activity score."
        )
    if "no_phase" in flags:
        note_parts.append(diplotype_note or "Diplotype is unphased; trans configuration assumed.")
    if "HapB3_proxy_only" in flags:
        note_parts.append("DPYD HapB3 called from proxy SNP rs56038477 only; confirm rs75017182.")
    if "unknown_star" in flags:
        note_parts.append("One or more star alleles not in CPIC activity table; phenotype set to Unknown.")
    note_parts.extend(context_notes)
    notes = " ".join(note_parts) if note_parts else None

    action_label = _map_risk_label(risk["risk_label"])

    citation = _build_citation(risk["cpic_version"], primary_gene)
    clinical_text = _build_clinical_recommendation_text(
        drug=drug_key,
        gene=primary_gene,
        diplotype=diplotype,
        phenotype=phenotype,
        activity_score=activity_score,
        action=action_label,
        severity=_severity_from_risk_category(risk_category),
        confidence_score=float(round(adjusted_confidence, 4)),
        evidence_level=str(risk.get("evidence_level", "N/A")),
        cpic_recommendation=str(risk.get("recommendation", "")),
        data_quality_notes=notes,
        flags=flags,
        cpic_guideline_version=str(citation.get("guideline_version")) if isinstance(citation, dict) else None,
        cpic_doi=str(citation.get("doi")) if isinstance(citation, dict) and citation.get("doi") else None,
        cpic_url=str(citation.get("url")) if isinstance(citation, dict) and citation.get("url") else None,
    )

    return {
        "patient_id": patient_id,
        "drug":       drug_key,
        "timestamp":  timestamp,
        "risk_assessment": {
            "risk_label":       action_label,
            "confidence_score": round(adjusted_confidence, 4),
            "severity":         _severity_from_risk_category(risk_category),
        },
        "pharmacogenomic_profile": {
            "primary_gene":      primary_gene,
            "diplotype":         diplotype,
            "phenotype":         phenotype,
            "detected_variants": detected_variants,
            "flags":             flags,
            "notes":             notes,
        },
        "clinical_recommendation": {
            "cpic_guideline":      clinical_text,
            "data_quality_notes":  notes,
            "action":              action_label,
        },
        "quality_metrics": {
            "vcf_parsing_success": bool(vcf_ok),
            "total_variants": int(total_variants),
            "genes_covered": int(genes_covered),
        },
    }


def save_report(report: dict[str, Any]) -> Path:
    """Save *report* as a JSON file inside the Output/ directory.

    Filename format: <patient_id>_<drug>_<YYYYMMDD_HHMMSS>.json
    Returns the Path of the saved file.
    """
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Build a filesystem-safe timestamp from the report's ISO timestamp.
    ts_raw  = report.get("timestamp", datetime.now(timezone.utc).isoformat())
    ts_safe = ts_raw.replace(":", "-").replace("+", "_").replace(".", "-")[:19]

    patient = str(report.get("patient_id", "unknown")).replace(" ", "_")
    drug    = str(report.get("drug", "unknown")).replace(" ", "_")

    filename = f"{patient}_{drug}_{ts_safe}.json"
    out_path = _OUTPUT_DIR / filename

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    return out_path


# ── Error report helper ───────────────────────────────────────────────────────

def _error_report(
    patient_id: str, drug: str, timestamp: str, message: str
) -> dict[str, Any]:
    """Return a minimal valid report when the pipeline cannot complete."""
    return {
        "patient_id": patient_id,
        "drug":       drug,
        "timestamp":  timestamp,
        "risk_assessment": {
            "risk_label":            "Unknown",
            "severity":              "none",
            "confidence_score":      0.0,
        },
        "pharmacogenomic_profile": {
            "primary_gene":      "",
            "diplotype":         "",
            "phenotype":         "Unknown",
            "detected_variants": [],
        },
        "clinical_recommendation": {
            "cpic_guideline": None,
            "data_quality_notes": message,
            "action": "Unknown",
        },
        "llm_generated_explanation": {"error": message},
        "quality_metrics": {
            "vcf_parsing_success": False,
            "total_variants": 0,
            "genes_covered": 0,
        },
    }


# ── CLI entry-point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    _load_dotenv_if_present()
    if len(sys.argv) < 3:
        print(
            "Usage: python pipeline.py <vcf_path> <drug> [patient_id]\n"
            "\n"
            "Examples:\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf SIMVASTATIN\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE PATIENT_001\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf WARFARIN\n"
            "\n"
            f"Supported drugs: {', '.join(sorted(_DRUG_TO_GENE))}",
            file=sys.stderr,
        )
        sys.exit(1)

    vcf_arg  = sys.argv[1]
    # Collect drug names: everything after vcf_path that is not a --patient/--llm flag
    drugs: list[str] = []
    patient_id: str | None = None
    enable_llm = bool(os.getenv("GROQ_API_KEY"))

    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == "--patient" and i + 1 < len(args):
            patient_id = args[i + 1]
            i += 2
        elif args[i] == "--llm":
            enable_llm = True
            i += 1
        elif args[i] == "--no-llm":
            enable_llm = False
            i += 1
        else:
            drugs.append(args[i])
            i += 1

    if not drugs:
        print(
            "Usage: python pipeline.py <vcf_path> <drug> [drug2 ...] [--patient ID]\n"
            "\n"
            "Single drug:\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE --patient PATIENT_001\n"
            "\n"
            "Multiple drugs (VCF parsed once):\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE WARFARIN SIMVASTATIN\n"
            "  python pipeline.py VCF_File/sample_pgx_500.vcf CODEINE WARFARIN --patient P001\n"
            "\n"
            f"Supported drugs: {', '.join(sorted(_DRUG_TO_GENE))}",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(drugs) == 1:
        # Single drug — keep simple, backward-compatible behaviour
        report   = run_pipeline(vcf_arg, drugs[0], patient_id, enable_llm=enable_llm)
        out_path = save_report(report)
        print(f"[pipeline] Report saved → {out_path}", file=sys.stderr)
        print(json.dumps(report, indent=2))
    else:
        # Multiple drugs — parse VCF once, produce one report per drug
        reports = run_pipeline_multi(vcf_arg, drugs, patient_id, enable_llm=enable_llm)
        for report in reports:
            out_path = save_report(report)
            print(f"[pipeline] Report saved → {out_path}", file=sys.stderr)
        print(json.dumps(reports, indent=2))
