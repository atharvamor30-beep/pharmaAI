"""
drug_risk_map.py
================
Offline, deterministic CPIC drug-risk prediction layer.

All data sourced exclusively from official CPIC publications (cpicpgx.org)
and peer-reviewed CPIC papers. No runtime web calls are made.

Covered gene-drug pairs (6 pairs):
    CYP2D6   -> CODEINE       (CPIC 2020, DOI:10.1002/cpt.1680)
    CYP2C19  -> CLOPIDOGREL   (CPIC 2022, DOI:10.1002/cpt.2526)
    CYP2C9   -> WARFARIN      (CPIC 2017, DOI:10.1002/cpt.668)
    SLCO1B1  -> SIMVASTATIN   (CPIC 2022, DOI:10.1002/cpt.2557)
    TPMT     -> AZATHIOPRINE  (CPIC 2019 + 2025 update, DOI:10.1002/cpt.1172)
    DPYD     -> FLUOROURACIL  (CPIC 2024 update, DOI:10.1002/cpt.2450)

Risk label vocabulary (standardised) + derived fields:

    Risk Label         Severity   Confidence (evidence A / B / N/A)
    -----------------  ---------  ----------------------------------
    Safe               none       0.95 / 0.75 / 0.0
    Adjust Dose        moderate   0.95 / 0.75 / 0.0
    Avoid              high       0.95 / 0.75 / 0.0
    Reduced Efficacy   low        0.95 / 0.75 / 0.0
    Contraindicated    critical   0.95 / 0.75 / 0.0
    Unknown            none       0.0
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# CPIC Drug-Risk Map
# ---------------------------------------------------------------------------
# Structure: CPIC_DRUG_RISK_MAP[gene][drug][phenotype] = { attributes }
#
# Phenotype keys match the output of phenotype_calculator.compute_phenotype():
#   NM, IM, PM, UM, RM  (RM = Rapid Metabolizer, CYP2C19-specific)
# ---------------------------------------------------------------------------

CPIC_DRUG_RISK_MAP: dict[str, dict[str, dict[str, dict[str, str]]]] = {

    # ========================================================================
    # CYP2D6 — CODEINE
    # Source: CPIC Guideline for Opioids and CYP2D6 (2020)
    #         DOI: 10.1002/cpt.1680 | CPIC Evidence Level A
    #
    # Codeine is a prodrug converted to morphine by CYP2D6.
    # UM: dangerously high morphine → toxicity risk.
    # PM: negligible conversion → no analgesia.
    # ========================================================================
    "CYP2D6": {
        "CODEINE": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Label-recommended, age- or weight-specific starting dose is "
                    "warranted. Normal CYP2D6 activity; standard morphine conversion."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2020 (DOI:10.1002/cpt.1680)",
            },
            "IM": {
                "risk_label": "Adjust Dose",
                "recommendation": (
                    "Label-recommended starting dose is recommended. Monitor closely "
                    "for suboptimal analgesic response. If response is inadequate, "
                    "consider an alternative non-opioid or CYP2D6-independent opioid "
                    "(e.g., morphine, hydromorphone)."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2020 (DOI:10.1002/cpt.1680)",
            },
            "PM": {
                "risk_label": "Avoid",
                "recommendation": (
                    "Avoid codeine use. Negligible CYP2D6 activity results in "
                    "insufficient conversion to active morphine, leading to lack of "
                    "analgesic effect. Use an alternative non-opioid or a CYP2D6-"
                    "independent opioid (e.g., morphine, hydromorphone, oxycodone)."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2020 (DOI:10.1002/cpt.1680)",
            },
            "UM": {
                "risk_label": "Contraindicated",
                "recommendation": (
                    "Avoid codeine use. Ultrarapid CYP2D6 activity results in "
                    "excessive morphine formation, causing life-threatening respiratory "
                    "depression and CNS toxicity. Use an alternative non-opioid or a "
                    "CYP2D6-independent opioid (e.g., morphine, hydromorphone)."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2020 (DOI:10.1002/cpt.1680)",
            },
            # RM (Rapid Metabolizer) not defined for CYP2D6 by CPIC.
        },
    },

    # ========================================================================
    # CYP2C19 — CLOPIDOGREL
    # Source: CPIC Guideline for CYP2C19 and Clopidogrel Therapy (2022)
    #         DOI: 10.1002/cpt.2526 | CPIC Evidence Level A
    #
    # Clopidogrel is a prodrug; CYP2C19 converts it to active thiol metabolite.
    # IM/PM: impaired activation → reduced platelet inhibition → ↑ MACE risk.
    # UM/RM: enhanced activation → potentially increased efficacy (less well-studied).
    # ========================================================================
    "CYP2C19": {
        "CLOPIDOGREL": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Initiate clopidogrel at standard label-recommended dose. Normal "
                    "CYP2C19 activity provides adequate conversion to active metabolite "
                    "and expected platelet inhibition."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2526)",
            },
            "IM": {
                "risk_label": "Avoid",
                "recommendation": (
                    "CYP2C19 intermediate metabolizers have reduced platelet inhibition "
                    "and increased risk of major adverse cardiovascular events (MACE). "
                    "For ACS patients undergoing PCI, use an alternative P2Y12 inhibitor "
                    "(prasugrel or ticagrelor) if no contraindications exist."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2526)",
            },
            "PM": {
                "risk_label": "Avoid",
                "recommendation": (
                    "CYP2C19 poor metabolizers have significantly reduced platelet "
                    "inhibition and substantially increased risk of MACE. Use an "
                    "alternative P2Y12 inhibitor (prasugrel or ticagrelor) if no "
                    "contraindications exist. Clopidogrel should not be used."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2526)",
            },
            "RM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Initiate clopidogrel at standard label-recommended dose. Rapid "
                    "CYP2C19 metabolizers generally achieve adequate platelet inhibition. "
                    "No dose adjustment required."
                ),
                "evidence_level": "B",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2526)",
            },
            "UM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Initiate clopidogrel at standard label-recommended dose. Ultrarapid "
                    "CYP2C19 metabolizers achieve at least normal levels of active "
                    "metabolite. No dose adjustment required based on CPIC guidance."
                ),
                "evidence_level": "B",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2526)",
            },
        },
    },

    # ========================================================================
    # CYP2C9 — WARFARIN
    # Source: CPIC Guideline for CYP2C9 and VKORC1 Genotypes and Warfarin Dosing
    #         (2017) DOI: 10.1002/cpt.668 | CPIC Evidence Level A (non-African)
    #                                               Level B (African ancestry)
    #
    # CPIC warfarin guideline is primarily genotype-driven (not phenotype-driven).
    # Phenotype-level mappings below represent a conservative interpretation
    # of the genotype-grouping tables in the 2017 publication.
    #
    # IMPORTANT: CPIC explicitly recommends using validated pharmacogenetic
    # dosing algorithms (e.g., IWPC) incorporating CYP2C9 + VKORC1 + ancestry.
    # The recommendations below apply when algorithm use is not feasible.
    # ========================================================================
    "CYP2C9": {
        "WARFARIN": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Initiate warfarin using a validated pharmacogenetic dosing algorithm "
                    "incorporating CYP2C9, VKORC1, and clinical factors. Standard "
                    "starting dose is appropriate for CYP2C9 *1/*1 (normal metabolizers). "
                    "Monitor INR closely during initiation."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2017 (DOI:10.1002/cpt.668)",
            },
            "IM": {
                "risk_label": "Adjust Dose",
                "recommendation": (
                    "CYP2C9 intermediate metabolizers have reduced S-warfarin clearance. "
                    "Use a validated pharmacogenetic dosing algorithm. Anticipate lower "
                    "dose requirements (approximately 15–30% reduction vs. average), "
                    "especially for *2/*2 or *1/*3 diplotypes. Monitor INR closely. "
                    "Allow longer time to achieve stable INR."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2017 (DOI:10.1002/cpt.668)",
            },
            "PM": {
                "risk_label": "Adjust Dose",
                "recommendation": (
                    "CYP2C9 poor metabolizers (e.g., *2/*3, *3/*3) require significantly "
                    "lower warfarin doses and face substantially increased bleeding risk. "
                    "Use a validated pharmacogenetic dosing algorithm. If algorithm is "
                    "unavailable and a VKORC1-sensitive genotype is also present, consider "
                    "an alternative anticoagulant (e.g., DOAC). Intensive INR monitoring "
                    "is mandatory during initiation."
                ),
                "evidence_level": "B",
                "cpic_version": "CPIC 2017 (DOI:10.1002/cpt.668)",
            },
            # UM not clinically defined for warfarin by CPIC.
        },
    },

    # ========================================================================
    # SLCO1B1 — SIMVASTATIN
    # Source: CPIC Guideline for SLCO1B1, ABCG2, and CYP2C9 and Statin-Associated
    #         Musculoskeletal Symptoms (SAMS) (2022)
    #         DOI: 10.1002/cpt.2557 | CPIC Evidence Level A (SLCO1B1/simvastatin)
    #
    # SLCO1B1 encodes the OATP1B1 hepatic uptake transporter.
    # Decreased/poor SLCO1B1 function → elevated plasma simvastatin acid →
    # increased risk of statin-associated myopathy (SAMS).
    # ========================================================================
    "SLCO1B1": {
        "SIMVASTATIN": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Normal SLCO1B1 function. Prescribe desired statin intensity per "
                    "current standard of care and ACC/AHA guidelines. No SLCO1B1-driven "
                    "dose limitation for simvastatin."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2557)",
            },
            "IM": {
                "risk_label": "Avoid",
                "recommendation": (
                    "Decreased SLCO1B1 function. Prescribe an alternative statin with "
                    "lower SAMS risk (e.g., rosuvastatin, pravastatin, or fluvastatin at "
                    "clinically appropriate doses). If simvastatin is necessary, limit the "
                    "dose to ≤20 mg/day and increase clinical monitoring for myopathy "
                    "symptoms (muscle pain, weakness, CK elevation)."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2557)",
            },
            "PM": {
                "risk_label": "Contraindicated",
                "recommendation": (
                    "Poor SLCO1B1 function. Prescribe an alternative statin with lower "
                    "SAMS risk (e.g., rosuvastatin, pravastatin, or fluvastatin). "
                    "Simvastatin is associated with a substantially increased risk of "
                    "myopathy and rhabdomyolysis at standard doses. Do not use simvastatin "
                    "unless no alternatives exist; if unavoidable, use the lowest possible "
                    "dose with intensive monitoring."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2022 (DOI:10.1002/cpt.2557)",
            },
            # Increased function: SLCO1B1 *14/*14 — not specifically addressed by
            # CPIC for simvastatin dose adjustment; treated as NM for safety.
        },
    },

    # ========================================================================
    # TPMT — AZATHIOPRINE
    # Source: CPIC Guideline for Thiopurine Dosing Based on TPMT and NUDT15 (2019)
    #         DOI: 10.1002/cpt.1172 | Updated 2024/2025
    #         CPIC Evidence Level A
    #
    # Azathioprine is converted to 6-MP, then to thioguanine nucleotides (TGNs).
    # TPMT inactivates these TGNs. Low TPMT → TGN accumulation → myelosuppression.
    # NOTE: NUDT15 also affects thiopurine toxicity (separate gene, not covered here).
    # ========================================================================
    "TPMT": {
        "AZATHIOPRINE": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Normal TPMT activity. Start azathioprine at the normal starting dose "
                    "(2–3 mg/kg/day for IBD/rheumatology indications). Adjust doses per "
                    "disease-specific guidelines. Allow ≥2 weeks to reach steady-state "
                    "after each dose adjustment. Monitor CBC regularly."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2019+2025 (DOI:10.1002/cpt.1172)",
            },
            "IM": {
                "risk_label": "Adjust Dose",
                "recommendation": (
                    "Reduced TPMT activity. Start at 30–80% of the normal azathioprine "
                    "dose (e.g., ~0.6–2.4 mg/kg/day). Adjust dose based on myelosuppression "
                    "and disease-specific guidelines. Allow 2–4 weeks to reach steady-state "
                    "after each dose adjustment. Monitor CBC frequently. If the initial dose "
                    "is already low for the indication, dose reduction may not be necessary."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2019+2025 (DOI:10.1002/cpt.1172)",
            },
            "PM": {
                "risk_label": "Contraindicated",
                "recommendation": (
                    "Absent TPMT activity. For non-malignant conditions, use an alternative "
                    "non-thiopurine immunosuppressant (e.g., mycophenolate mofetil). "
                    "If thiopurine must be used for a malignant indication, use a drastically "
                    "reduced dose (10-fold reduction, administered 3×/week instead of daily) "
                    "with intensive myelosuppression monitoring. Allow 4–6 weeks per dose "
                    "adjustment. Risk of fatal myelosuppression is extremely high."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2019+2025 (DOI:10.1002/cpt.1172)",
            },
        },
    },

    # ========================================================================
    # DPYD — FLUOROURACIL (5-FU)
    # Source: CPIC Guideline for DPYD and Fluoropyrimidines (2024 update)
    #         DOI: 10.1002/cpt.2450 (2022 base) | Updated Jan 2024, edited Mar 2024
    #         CPIC Evidence Level A (NM, PM) / Moderate (IM)
    #
    # DPD (DPYD gene product) catabolises >80% of administered 5-FU.
    # Reduced DPD activity → prolonged 5-FU exposure → severe/fatal toxicity.
    # Activity score (AS): NM=2.0, IM=1.0–1.5, PM=0.0–0.5
    # ========================================================================
    "DPYD": {
        "FLUOROURACIL": {
            "NM": {
                "risk_label": "Safe",
                "recommendation": (
                    "Normal DPD activity (activity score = 2.0). Administer 5-fluorouracil "
                    "at the full label-recommended starting dose per disease protocol. "
                    "No DPYD-based dose modification required."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2024 update (DOI:10.1002/cpt.2450)",
            },
            "IM": {
                "risk_label": "Adjust Dose",
                "recommendation": (
                    "Decreased DPD activity (activity score 1.0 or 1.5). Start at 50% of "
                    "the normal 5-fluorouracil dose. Titrate dose based on clinical "
                    "tolerability and, ideally, therapeutic drug monitoring. If the first "
                    "two cycles are tolerated, dose escalation (≤10% per cycle) may be "
                    "considered. For homozygous c.[2846A>T];[2846A>T] (AS=1.0), a "
                    "reduction exceeding 50% may be warranted."
                ),
                "evidence_level": "B",
                "cpic_version": "CPIC 2024 update (DOI:10.1002/cpt.2450)",
            },
            "PM": {
                "risk_label": "Contraindicated",
                "recommendation": (
                    "Severely reduced or absent DPD activity (activity score 0.0 or 0.5). "
                    "Avoid 5-fluorouracil and all fluoropyrimidine-based regimens (including "
                    "capecitabine). No safe dose has been established for complete DPD "
                    "deficiency (AS=0). If AS=0.5 and no alternative exists, a strongly "
                    "reduced dose (>75% reduction from standard) with early therapeutic drug "
                    "monitoring may be considered only after careful risk-benefit assessment. "
                    "FDA label updated 2024 to reflect DPD deficiency risk."
                ),
                "evidence_level": "A",
                "cpic_version": "CPIC 2024 update (DOI:10.1002/cpt.2450)",
            },
        },
    },
}


# ---------------------------------------------------------------------------
# Derived-field lookup tables  (risk_label → severity / evidence → confidence)
# ---------------------------------------------------------------------------
# severity: maps clinical urgency for the final JSON schema.
# confidence_score: reflects strength of CPIC evidence behind the call.

_SEVERITY_MAP: dict[str, str] = {
    "Safe":             "none",
    "Adjust Dose":      "moderate",
    "Avoid":            "high",
    "Reduced Efficacy": "low",
    "Contraindicated":  "critical",
    "Unknown":          "none",
}

_CONFIDENCE_MAP: dict[str, float] = {
    "A":   0.95,
    "B":   0.75,
    "N/A": 0.0,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_drug_risk(gene: str, phenotype: str, drug: str) -> dict[str, Any]:
    """Return the CPIC-based drug risk assessment for a gene-phenotype-drug triple.

    Inputs are normalised to uppercase and leading/trailing whitespace is stripped.
    The function is fully offline and deterministic — it never makes network calls.

    Args:
        gene:      Gene symbol, e.g. "CYP2D6", "TPMT".
        phenotype: CPIC phenotype code, e.g. "NM", "IM", "PM", "UM", "RM".
        drug:      Drug name in any case, e.g. "codeine", "WARFARIN".

    Returns:
        dict with keys:
            gene, drug, phenotype,
            risk_label, severity, confidence_score,   ← new in v2
            recommendation, evidence_level, cpic_version.
        If the combination is not found, risk_label is "Unknown", severity is
        "none", confidence_score is 0.0, and recommendation explains the miss.

    Example:
        >>> get_drug_risk("CYP2D6", "UM", "codeine")
        {'gene': 'CYP2D6', 'drug': 'CODEINE', 'phenotype': 'UM',
         'risk_label': 'Contraindicated', 'severity': 'critical',
         'confidence_score': 0.95, ...}
    """
    # Normalise inputs
    gene_key      = str(gene).strip().upper()
    phenotype_key = str(phenotype).strip().upper()
    drug_key      = str(drug).strip().upper()

    # Walk the nested map safely
    gene_map = CPIC_DRUG_RISK_MAP.get(gene_key)
    if gene_map is None:
        return _unknown_result(gene_key, drug_key, phenotype_key,
                               f"Gene '{gene_key}' not in CPIC drug risk map.")

    drug_map = gene_map.get(drug_key)
    if drug_map is None:
        return _unknown_result(gene_key, drug_key, phenotype_key,
                               f"Drug '{drug_key}' not covered for gene '{gene_key}' "
                               f"in CPIC drug risk map.")

    entry = drug_map.get(phenotype_key)
    if entry is None:
        return _unknown_result(gene_key, drug_key, phenotype_key,
                               f"Phenotype '{phenotype_key}' not explicitly defined by "
                               f"CPIC for {gene_key}/{drug_key}.")

    risk_label     = entry["risk_label"]
    evidence_level = entry["evidence_level"]

    return {
        "gene":             gene_key,
        "drug":             drug_key,
        "phenotype":        phenotype_key,
        # --- risk_assessment fields (ready for final JSON schema) ---
        "risk_label":       risk_label,
        "severity":         _SEVERITY_MAP.get(risk_label, "none"),
        "confidence_score": _CONFIDENCE_MAP.get(evidence_level, 0.0),
        # --- clinical_recommendation fields ---
        "recommendation":   entry["recommendation"],
        "evidence_level":   evidence_level,
        "cpic_version":     entry["cpic_version"],
    }


def _unknown_result(gene: str, drug: str, phenotype: str, reason: str) -> dict[str, Any]:
    """Return a safe Unknown result dict."""
    return {
        "gene":             gene,
        "drug":             drug,
        "phenotype":        phenotype,
        "risk_label":       "Unknown",
        "severity":         "none",
        "confidence_score": 0.0,
        "recommendation":   reason,
        "evidence_level":   "N/A",
        "cpic_version":     "N/A",
    }


# ---------------------------------------------------------------------------
# Validation / Example Calls
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    test_cases = [
        # (gene,      phenotype, drug)
        ("CYP2D6",   "UM",      "CODEINE"),        # Contraindicated
        ("CYP2C19",  "PM",      "CLOPIDOGREL"),    # Avoid
        ("CYP2C9",   "IM",      "WARFARIN"),       # Adjust Dose
        ("SLCO1B1",  "PM",      "SIMVASTATIN"),    # Contraindicated
        ("TPMT",     "PM",      "AZATHIOPRINE"),   # Contraindicated
        ("DPYD",     "PM",      "FLUOROURACIL"),   # Contraindicated
        # Edge cases
        ("CYP2D6",   "NM",      "codeine"),        # Safe (lowercase normalised)
        ("TPMT",     "IM",      "Azathioprine"),   # Adjust Dose (mixed case)
        ("CYP2D6",   "PM",      "ASPIRIN"),        # Unknown — not in map
        ("BRCA1",    "PM",      "CODEINE"),        # Unknown — gene not in map
    ]

    separator = "-" * 70
    for gene, phenotype, drug in test_cases:
        result = get_drug_risk(gene, phenotype, drug)
        print(separator)
        print(f"Query  : gene={gene!r}  phenotype={phenotype!r}  drug={drug!r}")
        print(f"Result : {json.dumps(result, indent=2)}")
    print(separator)
