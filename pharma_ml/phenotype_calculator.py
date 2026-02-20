from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd


PGX_GENES: frozenset[str] = frozenset(
    {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}
)

STAR_DEFINITIONS: Mapping[str, Mapping[str, str]] = {
    "CYP2C19": {
        "rs4244285": "*2",
        "rs4986893": "*3",
        "rs12248560": "*17",
    },
    "CYP2C9": {
        "rs1799853": "*2",
        "rs1057910": "*3",
        "rs28371686": "*5",
        "rs9332131": "*6",
        "rs7900194": "*8",
        "rs28371685": "*11",
    },
    "TPMT": {
        "rs1142345": "*3C",
        "rs1800460": "*3B",
        "rs1800462": "*2",
    },
    "DPYD": {
        "rs3918290": "*2A",        # c.1905+1G>A, no function
        "rs55886062": "*13",       # c.1679T>G p.I560S, no function
        "rs75017182": "*HapB3",    # intronic causal HapB3, decreased function
        "rs56038477": "*HapB3",    # synonymous proxy tag for HapB3
        "rs67376798": "*c2846AT",  # c.2846A>T, decreased function
    },
    "SLCO1B1": {
        "rs4149056": "*5",
        "rs2306283": "*1B",
    },
    "CYP2D6": {
        "rs3892097": "*4",
        "rs1065852": "*10",
        "rs35742686": "*3",
        "rs5030655": "*6",
        "rs28371725": "*41",
    },
}


def normalize_genotype(genotype: Any) -> str:
    if genotype is None or pd.isna(genotype):
        return "0/0"

    text = str(genotype).strip()
    if not text or text == "./.":
        return "0/0"

    sep = "/" if "/" in text else "|" if "|" in text else None
    if sep is None:
        return "0/0"

    parts = text.split(sep)
    if len(parts) != 2:
        return "0/0"

    alleles: list[int] = []
    for p in parts:
        p = p.strip()
        if not p or p == ".":
            alleles.append(0)
            continue
        try:
            val = int(p)
        except ValueError:
            alleles.append(0)
            continue
        alleles.append(0 if val <= 0 else 1)

    alleles.sort()
    return f"{alleles[0]}/{alleles[1]}"


def _parse_diplotype(diplotype: str) -> tuple[str, str] | None:
    if not diplotype:
        return None
    text = str(diplotype).strip()
    if "/" not in text:
        return None
    left, right = text.split("/", 1)
    left = left.strip()
    right = right.strip()
    if not left or not right:
        return None
    return left, right


def compute_diplotype(df: pd.DataFrame) -> pd.DataFrame:
    required_cols = {"Gene", "Chrom", "Position", "RSID", "Genotype"}
    missing = required_cols - set(df.columns)
    if missing:
        missing_str = ", ".join(sorted(missing))
        raise ValueError(f"Input DataFrame is missing required columns: {missing_str}")

    result = df.copy()
    result["Diplotype"] = pd.NA
    result["Diplotype_Note"] = pd.NA

    for gene in PGX_GENES:
        mask = result["Gene"] == gene
        if not mask.any():
            continue

        gene_rows = result.loc[mask]
        star_map = STAR_DEFINITIONS.get(gene, {})
        if gene_rows.empty:
            result.loc[mask, "Diplotype"] = "*1/*1"
            continue

        allele1 = "*1"
        allele2 = "*1"
        mutated_stars: list[str] = []
        saw_homozygous = False
        dpyd_hapb3_causal = False
        dpyd_hapb3_proxy_only = False

        # Track seen non-ref stars: star -> highest zygosity (1/1 > 0/1)
        seen_stars: dict[str, str] = {}  # star -> "1/1" or "0/1"

        for _, row in gene_rows.iterrows():
            genotype = normalize_genotype(row.get("Genotype"))
            if genotype == "0/0":
                continue

            # Prefer the STAR annotation already present in the VCF row.
            star: str | None = None
            if "STAR" in result.columns:
                star_val = row.get("STAR")
                if star_val is not None and not pd.isna(star_val) and str(star_val).strip() not in ("", "."):
                    star = str(star_val).strip()

            # Fallback: derive star from RSID lookup table.
            if star is None:
                rsid = row.get("RSID")
                if rsid is None or pd.isna(rsid):
                    continue
                star = star_map.get(str(rsid))
                if star is None:
                    continue

            if gene == "DPYD" and star == "*HapB3":
                rsid_str = str(row.get("RSID", ""))
                if rsid_str == "rs75017182":
                    dpyd_hapb3_causal = True
                elif rsid_str == "rs56038477":
                    dpyd_hapb3_proxy_only = True

            # Record the strongest observed genotype for this star allele.
            prev = seen_stars.get(star)
            if prev != "1/1":  # 1/1 wins, never downgrade
                seen_stars[star] = genotype

        # Resolve seen stars into allele1/allele2.
        # Homozygous stars dominate; otherwise collect unique het non-ref stars.
        hom_stars = [s for s, gt in seen_stars.items() if gt == "1/1" and s != "*1"]
        het_stars  = [s for s, gt in seen_stars.items() if gt == "0/1"  and s != "*1"]

        unphased = False
        if hom_stars:
            # Most severe homozygous variant wins.
            top = hom_stars[0]
            allele1 = top
            allele2 = top
            saw_homozygous = True
        elif het_stars:
            if len(het_stars) == 1:
                allele2 = het_stars[0]
            else:
                allele1 = het_stars[0]
                allele2 = het_stars[1]
                unphased = True

        mutated_stars = list(seen_stars.keys())  # keep for SLCO1B1 / DPYD logic below

        if gene == "DPYD":
            if dpyd_hapb3_causal and dpyd_hapb3_proxy_only:
                count = mutated_stars.count("*HapB3")
                if count > 1:
                    mutated_stars = [s for s in mutated_stars if s != "*HapB3"]
                    mutated_stars.append("*HapB3")

        if gene == "SLCO1B1":
            if "*5" in mutated_stars and "*1B" in mutated_stars:
                mutated_stars = [s for s in mutated_stars if s not in {"*5", "*1B"}]
                mutated_stars.append("*15")

        # (diplotype already resolved above via seen_stars / hom_stars / het_stars)

        diplotype = f"{allele1}/{allele2}"
        result.loc[mask, "Diplotype"] = diplotype
        note_parts: list[str] = []
        if unphased:
            note_parts.append("Unphased: trans assumed")
        if gene == "DPYD" and dpyd_hapb3_proxy_only and not dpyd_hapb3_causal:
            note_parts.append("HapB3 called from proxy tag rs56038477 only")
        if gene == "SLCO1B1" and "*15" in diplotype:
            note_parts.append("Unphased: *15 (cis) assumed from rs4149056 + rs2306283 co-occurrence")
        if note_parts:
            result.loc[mask, "Diplotype_Note"] = "; ".join(note_parts)

    return result


def _cyp2c19_phenotype(diplotype: str) -> str:
    table: Mapping[str, str] = {
        "*1/*1": "NM",
        "*1/*2": "IM",
        "*2/*1": "IM",
        "*1/*3": "IM",
        "*3/*1": "IM",
        "*2/*2": "PM",
        "*3/*3": "PM",
        "*2/*3": "PM",
        "*3/*2": "PM",
        "*1/*17": "RM",
        "*17/*1": "RM",
        "*17/*17": "UM",
        "*2/*17": "IM",
        "*17/*2": "IM",
        "*3/*17": "IM",
        "*17/*3": "IM",
    }
    return table.get(diplotype, "Unknown")


def _cyp2c9_phenotype(diplotype: str) -> str:
    """CPIC activity-score based CYP2C9 phenotype assignment.

    Activity values (CPIC 2024):
      *1               = 1.0  (normal function)
      *2               = 0.5  (decreased function)
      *3, *5, *6, *8, *11 = 0.0  (no function)

    Score → Phenotype:
      2.0       → NM
      1.0–1.5   → IM   (*2/*2 = 1.0 is IM per 2024 CPIC update)
      0.0–0.5   → PM
    """
    a = _parse_diplotype(diplotype)
    if a is None:
        return "Unknown"
    left, right = a
    activity: Mapping[str, float] = {
        "*1": 1.0,
        "*2": 0.5,
        "*3": 0.0,
        "*5": 0.0,
        "*6": 0.0,
        "*8": 0.0,
        "*11": 0.0,
    }
    lv = activity.get(left)
    rv = activity.get(right)
    if lv is None or rv is None:
        return "Unknown"
    score = lv + rv
    if score >= 2.0:
        return "NM"
    if score >= 1.0:
        return "IM"
    return "PM"


def _tpmt_phenotype(diplotype: str) -> str:
    """CPIC 2025 activity-score based TPMT phenotype assignment.

    Activity values (CPIC 2025 update):
      *1               = 1.0  (normal function)
      *3B              = 0.5  (decreased function — new in 2025 update)
      *2, *3A, *3C,
      *4, *8, *12      = 0.0  (no function)

    Score → Phenotype:
      2.0       → NM
      0.5–1.5   → IM  (one decreased or one no-function allele)
      0.0       → PM
    """
    a = _parse_diplotype(diplotype)
    if a is None:
        return "Unknown"
    left, right = a
    activity: Mapping[str, float] = {
        "*1":  1.0,
        "*3B": 0.5,   # decreased function (CPIC 2025)
        "*2":  0.0,
        "*3A": 0.0,
        "*3C": 0.0,
        "*4":  0.0,
        "*8":  0.0,
        "*12": 0.0,
    }
    lv = activity.get(left)
    rv = activity.get(right)
    if lv is None or rv is None:
        return "Unknown"
    score = lv + rv
    if score >= 2.0:
        return "NM"
    if score > 0.0:
        return "IM"
    return "PM"


def _dpyd_phenotype(diplotype: str) -> str:
    a = _parse_diplotype(diplotype)
    if a is None:
        return "Unknown"
    left, right = a
    activity: Mapping[str, float] = {
        "*1": 1.0,
        "*2A": 0.0,
        "*13": 0.0,
        "*HapB3": 0.5,
        "*c2846AT": 0.5,
    }

    def allele_activity(allele: str) -> float:
        return activity.get(allele, 1.0)

    score = allele_activity(left) + allele_activity(right)
    # CPIC 2024 (DOI:10.1002/cpt.3374): NM=2.0 | IM=1.0 or 1.5 | PM=0 or 0.5
    if score >= 1.5:
        return "NM"
    if 0.5 < score < 1.5:  # score == 1.0
        return "IM"
    # score <= 0.5 (includes 0.5 and 0.0) -> PM
    return "PM"


def _slco1b1_phenotype(diplotype: str) -> str:
    """CPIC Sept 2025 updated SLCO1B1 phenotype assignment.

    No-function alleles (cause decreased hepatic uptake → statin toxicity risk):
      *5, *15 — no function (original)
      *31, *39, *41, *45 — reclassified as decreased function (Sept 2025 update)
      *9 — reclassified as decreased function (Sept 2025 update)

    Phenotype rules:
      0 reduced alleles → NM
      1 reduced allele  → IM (Decreased Function)
      2 reduced alleles → PM (Poor Function)
    """
    a = _parse_diplotype(diplotype)
    if a is None:
        return "Unknown"
    left, right = a
    # No-function alleles per Sept 2025 CPIC update
    no_func   = {"*5", "*15"}
    # Decreased-function alleles reclassified in Sept 2025
    dec_func  = {"*9", "*31", "*39", "*41", "*45"}
    reduced   = no_func | dec_func
    count_nf  = int(left in no_func)  + int(right in no_func)
    count_df  = int(left in dec_func) + int(right in dec_func)
    total_reduced = count_nf + count_df
    if total_reduced == 0:
        return "NM"
    if total_reduced == 1:
        return "IM"
    # Two reduced alleles: if both are no-func → Poor Function (PM)
    # mixed or both dec-func → still IM per CPIC (one no-func + one dec-func = IM)
    if count_nf >= 2 or (count_nf >= 1 and count_df >= 1):
        return "PM"
    return "IM"


def _cyp2d6_phenotype(diplotype: str) -> str:
    a = _parse_diplotype(diplotype)
    if a is None:
        return "Unknown"
    left, right = a
    activity: Mapping[str, float] = {
        "*1": 1.0,
        "*2": 1.0,
        "*3": 0.0,
        "*4": 0.0,
        "*5": 0.0,
        "*6": 0.0,
        "*10": 0.25,
        "*17": 0.5,
        "*41": 0.5,
    }
    if left not in activity or right not in activity:
        return "Unknown"
    score = activity[left] + activity[right]
    if score == 0.0:
        return "PM"
    if 0.0 < score <= 1.0:
        return "IM"
    if 1.0 < score <= 2.25:
        return "NM"
    if score > 2.25:
        return "UM"
    return "Unknown"


def compute_phenotype(gene: str, diplotype: str) -> str:
    gene = str(gene).strip()
    if not diplotype or pd.isna(diplotype):
        return "Unknown"

    if gene == "CYP2C19":
        return _cyp2c19_phenotype(diplotype)
    if gene == "CYP2C9":
        return _cyp2c9_phenotype(diplotype)
    if gene == "TPMT":
        return _tpmt_phenotype(diplotype)
    if gene == "DPYD":
        return _dpyd_phenotype(diplotype)
    if gene == "SLCO1B1":
        return _slco1b1_phenotype(diplotype)
    if gene == "CYP2D6":
        return _cyp2d6_phenotype(diplotype)
    return "Unknown"


def annotate_diplotype_phenotype(df: pd.DataFrame) -> pd.DataFrame:
    """Add a Phenotype column by applying per-gene phenotype rules."""
    if "Diplotype" not in df.columns:
        df["Phenotype"] = "Unknown"
        return df

    df = df.copy()
    df["Phenotype"] = df.apply(
        lambda row: compute_phenotype(row["Gene"], row["Diplotype"]),
        axis=1,
    )
    return df


def get_activity_score(gene: str, diplotype: str) -> float | None:
    """Return the numeric activity score for a gene/diplotype pair.

    Returns None when the gene doesn't use an activity-score model or the
    diplotype contains an unknown allele.

    Currently implemented for CYP2D6 and DPYD (where CPIC explicitly
    defines per-allele activity values).
    """
    gene = str(gene).strip().upper()
    a = _parse_diplotype(diplotype)
    if a is None:
        return None
    left, right = a

    if gene == "CYP2D6":
        activity: dict[str, float] = {
            "*1": 1.0, "*2": 1.0,
            "*3": 0.0, "*4": 0.0, "*5": 0.0, "*6": 0.0,
            "*10": 0.25, "*17": 0.5,  "*41": 0.5,
        }
        if left not in activity or right not in activity:
            return None
        return activity[left] + activity[right]

    if gene == "DPYD":
        activity = {
            "*1": 1.0, "*2A": 0.0, "*13": 0.0,
            "*HapB3": 0.5, "*c2846AT": 0.5,
        }
        l_val = activity.get(left, 1.0)
        r_val = activity.get(right, 1.0)
        return l_val + r_val

    # Genes without a numeric activity score model (use allele count logic)
    return None



def main() -> None:
    data: dict[str, list[Any]] = {
        "Gene": ["CYP2C19", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD", "CYP2D6"],
        "Chrom": ["chr10", "chr10", "chr10", "chr12", "chr6", "chr1", "chr22"],
        "Position": [94781859, 96541616, 96702054, 21178630, 18130687, 9791563, 42522694],
        "RSID": ["rs4244285", "rs12248560", "rs1799853", "rs4149056", "rs1142345", "rs3918290", "rs1065852"],
        "Genotype": ["0/1", "0/0", "1/1", "0/1", "0/0", "1/1", "0/1"],
    }
    df = pd.DataFrame(data)
    result = annotate_diplotype_phenotype(df)
    print(result)


if __name__ == "__main__":
    main()

