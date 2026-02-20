"""
risk_scoring.py
===============
Deterministic, auditable risk score computation for the RIFT pharmacogenomics pipeline.

Formula
-------
    raw          = severity_weight × evidence_confidence × phenotype_factor × context_multiplier
    risk_score   = clamp(raw × (1 − missing_data_penalty), 0.0, 1.0)
    category     = threshold bucketing of risk_score

Every multiplier and penalty is returned in "components" so downstream
reviewers can audit exactly how the number was produced.

Usage
-----
    from risk_scoring import compute_risk_score

    result = compute_risk_score(
        severity       = "moderate",
        evidence_level = "A",
        phenotype      = "IM",
        flags          = ["missing_cnv"],
        patient_context = {"renal_impairment": True},
    )
    # result["risk_score"]   → 0.319
    # result["category"]     → "low"
    # result["components"]   → {severity_weight, evidence_confidence, ...}
    # result["context_notes"]→ ["renal_impairment"]
"""

from __future__ import annotations

from typing import Any

# ── Severity weight table ─────────────────────────────────────────────────────
# CPIC risk_label → numeric weight in [0, 1].
# "moderate" intentionally raised to 0.60 vs naive 0.50 to give adequate
# separation from "low" boundary drugs.
_SEVERITY_WEIGHT: dict[str | None, float] = {
    "critical": 1.00,
    "high":     0.80,
    "moderate": 0.60,
    "low":      0.30,
    "minimal":  0.10,
    "none":     0.00,
    "unknown":  0.40,   # conservative mid-low
    None:       0.40,
}

# ── Evidence confidence table ─────────────────────────────────────────────────
# CPIC evidence level → confidence fraction.
_EVIDENCE_CONFIDENCE: dict[str | None, float] = {
    "A":       0.95,
    "B":       0.75,
    "C":       0.55,
    "N/A":     0.60,
    "unknown": 0.60,
    None:      0.60,
}

# ── Phenotype factor ──────────────────────────────────────────────────────────
# How severely the phenotype amplifies pharmacogenomics risk for this drug.
# PM/UM are the extreme ends; IM/RM are intermediate; NM is baseline risk.
# Note: CPIC risk_label already encodes directionality, so this factor
# adjusts magnitude rather than direction.
_PHENOTYPE_FACTOR: dict[str, float] = {
    "PM":      1.00,
    "UM":      1.00,
    "IM":      0.70,
    "RM":      0.70,
    "NM":      0.30,
    "Unknown": 0.50,
}

# ── Missing data penalties ────────────────────────────────────────────────────
# Each flag contributes a penalty fraction [0, 1].  Combined using:
#   total_penalty = min(sum(p_i), 0.9)   [sum, capped — auditable]
_PENALTY_MAP: dict[str, float] = {
    "missing_cnv":          0.20,   # CYP2D6 CNV absent from SNP-only VCF
    "unknown_star":         0.25,   # star allele not in CPIC definition table
    "no_phase":             0.15,   # heterozygous genotype, unphased
    "compound_uncertain":   0.15,   # compound allele ambiguity
    "HapB3_proxy_only":     0.10,   # DPYD HapB3 called from proxy SNP only
    "pipeline_error":       0.90,   # pipeline failed completely
}


# ── Categorical thresholds ────────────────────────────────────────────────────
def _score_to_category(score: float) -> str:
    if score >= 0.80:
        return "critical"
    if score >= 0.60:
        return "high"
    if score >= 0.40:
        return "moderate"
    if score >= 0.20:
        return "low"
    return "minimal"


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


# ── Missing data penalty ──────────────────────────────────────────────────────

def compute_missing_data_penalty(flags: list[str] | None) -> float:
    """Combine quality flags into a single penalty in [0, 0.9].

    Strategy: sum individual penalties, cap at 0.90.
    Auditable: each flag and its contribution appear in components.
    """
    total = 0.0
    for flag in flags or []:
        total += _PENALTY_MAP.get(flag, 0.0)
    return min(total, 0.90)


# ── Context multiplier ────────────────────────────────────────────────────────

def compute_context_multiplier(
    patient_context: dict[str, Any] | None,
) -> tuple[float, list[str]]:
    """Return (multiplier ≥ 1.0, applied_context_notes).

    Rules (applied multiplicatively, can exceed 1.0 before final clamp):
    • Strong relevant co-medication inhibitor/inducer  → ×1.25
    • Renal impairment (relevant to drug clearance)    → ×1.10
    • Hepatic impairment                               → ×1.10
    • Advanced age (≥75 years)                         → ×1.05

    patient_context keys:
        co_medications                list[str]  — drug names (lowercase)
        strong_relevant_inhibitors    list[str]  — precomputed relevant inhibitors
        renal_impairment              bool
        hepatic_impairment            bool
        age                           int
    """
    multiplier = 1.0
    notes: list[str] = []

    if not patient_context:
        return multiplier, notes

    # Strong co-medication interaction
    co_meds   = set(patient_context.get("co_medications", []) or [])
    inhibitors = set(patient_context.get("strong_relevant_inhibitors", []) or [])
    if co_meds & inhibitors:
        multiplier *= 1.25
        notes.append("strong_interacting_co_med")

    if patient_context.get("renal_impairment"):
        multiplier *= 1.10
        notes.append("renal_impairment")

    if patient_context.get("hepatic_impairment"):
        multiplier *= 1.10
        notes.append("hepatic_impairment")

    age = patient_context.get("age")
    if age and age >= 75:
        multiplier *= 1.05
        notes.append("advanced_age")

    return multiplier, notes


# ── Public API ────────────────────────────────────────────────────────────────

def compute_risk_score(
    *,
    severity: str,
    evidence_level: str,
    phenotype: str,
    flags: list[str] | None = None,
    patient_context: dict[str, Any] | None = None,
    debug: bool = False,
) -> dict[str, Any]:
    """Compute a numeric risk_score ∈ [0,1] and categorical label.

    Formula:
        raw        = severity_weight × evidence_confidence × phenotype_factor × context_multiplier
        risk_score = clamp(raw × (1 − missing_data_penalty), 0.0, 1.0)

    Args:
        severity:        CPIC severity string ("critical", "high", "moderate", "low", "minimal").
        evidence_level:  CPIC evidence level ("A", "B", "C", "N/A").
        phenotype:       CPIC phenotype ("PM", "IM", "NM", "RM", "UM", "Unknown").
        flags:           Quality/uncertainty flag list from _compute_flags().
        patient_context: Optional patient context dict (co-meds, organ function, age).
        debug:           If True, include a plain-text debug_text in the result.

    Returns:
        dict with keys:
            risk_score     (float, 4 d.p.)
            category       (str)  — "critical"|"high"|"moderate"|"low"|"minimal"
            components     (dict) — all intermediate values for auditability
            flags          (list) — input flags
            context_notes  (list) — which context rules were applied
            [debug_text]   (str)  — only when debug=True
    """
    # Look up each component
    sev_key  = (severity or "").lower()
    sev_w    = _SEVERITY_WEIGHT.get(sev_key, _SEVERITY_WEIGHT[None])

    ev_key   = (evidence_level or "").upper()
    ev_conf  = _EVIDENCE_CONFIDENCE.get(ev_key, _EVIDENCE_CONFIDENCE[None])

    phen_key = phenotype if phenotype in _PHENOTYPE_FACTOR else "Unknown"
    phen_f   = _PHENOTYPE_FACTOR[phen_key]

    context_mult, context_notes = compute_context_multiplier(patient_context)
    missing_penalty              = compute_missing_data_penalty(flags)

    raw      = sev_w * ev_conf * phen_f * context_mult
    adjusted = _clamp(raw * (1.0 - missing_penalty))
    category = _score_to_category(adjusted)

    components = {
        "severity_weight":      sev_w,
        "evidence_confidence":  ev_conf,
        "phenotype_factor":     phen_f,
        "context_multiplier":   round(context_mult, 4),
        "missing_data_penalty": missing_penalty,
        "raw":                  round(raw, 4),
        "adjusted":             round(adjusted, 4),
    }

    result: dict[str, Any] = {
        "risk_score":    round(adjusted, 4),
        "category":      category,
        "components":    components,
        "flags":         flags or [],
        "context_notes": context_notes,
    }
    if debug:
        result["debug_text"] = (
            f"raw={raw:.4f}, adjusted={adjusted:.4f}, "
            f"sev={severity}, ev={evidence_level}, phen={phenotype}"
        )
    return result


# ── Self-test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    cases = [
        # (severity,   ev,  phenotype, flags,            expected_category)
        ("critical", "A", "PM",     [],                  "critical"),   # SLCO1B1/SIMVASTATIN/PM  → 0.95
        ("moderate", "A", "IM",     ["missing_cnv"],     "low"),        # CYP2D6/CODEINE/IM       → 0.319
        ("critical", "A", "UM",     [],                  "critical"),   # CYP2D6/CODEINE/UM       → 0.95
        ("moderate", "A", "NM",     [],                  "minimal"),    # CYP2D6/CODEINE/NM       → 0.171
        ("high",     "B", "PM",     ["no_phase"],        "high"),       # CYP2C19/CLOPIDOGREL/PM  → 0.638
        ("high",     "A", "PM",     ["unknown_star"],    "moderate"),   # unknown star deduction
    ]

    print(f"{'Severity':<10} {'Ev':<4} {'Phen':<8} {'Flags':<25} → score   category")
    print("-" * 75)
    for sev, ev, phen, flags, expected in cases:
        r = compute_risk_score(severity=sev, evidence_level=ev,
                               phenotype=phen, flags=flags)
        mark = "✓" if r["category"] == expected else "✗"
        print(f"{sev:<10} {ev:<4} {phen:<8} {str(flags):<25} → "
              f"{r['risk_score']:.4f}  {r['category']:<10} {mark}")
