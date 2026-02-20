from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd


STAR_DEFINITIONS: Mapping[str, Mapping[str, str]] = {
    "CYP2C19": {
        "rs4244285": "*2",
        "rs4986893": "*3",
        "rs12248560": "*17",
    },
    "CYP2C9": {
        "rs1799853": "*2",
        "rs1057910": "*3",
    },
    "TPMT": {
        "rs1142345": "*3C",
        "rs1800460": "*3B",
        "rs1800462": "*2",
    },
    "DPYD": {
        "rs3918290": "*2A",
        "rs67376798": "*13",
        "rs55886062": "*HapB3",
    },
    "SLCO1B1": {
        "rs4149056": "*5",
    },
    "CYP2D6": {
        "rs3892097": "*4",
        "rs1065852": "*10",
    },
}


ALLELE_FUNCTION_MAP: Mapping[str, Mapping[str, str]] = {
    "CYP2C19": {
        "*1": "normal",
        "*2": "no function",
        "*3": "no function",
        "*17": "increased",
    },
    "CYP2C9": {
        "*1": "normal",
        "*2": "decreased",
        "*3": "decreased",
    },
    "TPMT": {
        "*1": "normal",
        "*2": "no function",
        "*3A": "no function",
        "*3B": "no function",
        "*3C": "no function",
    },
    "DPYD": {
        "*1": "normal",
        "*2A": "no function",
        "*13": "no function",
        "*HapB3": "decreased",
    },
    "SLCO1B1": {
        "*1": "normal",
        "*5": "decreased",
    },
    "CYP2D6": {
        "*1": "normal",
        "*2": "normal",
        "*4": "no function",
        "*5": "no function",
        "*10": "decreased",
        "*17": "decreased",
    },
}


def get_star_allele(gene: str, rsid: Any) -> str | None:
    gene = str(gene).strip()
    if not rsid or pd.isna(rsid):
        return None
    rsid_str = str(rsid).strip()
    gene_map = STAR_DEFINITIONS.get(gene)
    if not gene_map:
        return None
    return gene_map.get(rsid_str)


def get_allele_function(gene: str, star: str | None) -> str:
    if not star:
        return "unknown"
    gene = str(gene).strip()
    func_map = ALLELE_FUNCTION_MAP.get(gene)
    if not func_map:
        return "unknown"
    return func_map.get(star, "unknown")


def generate_detected_variants(df: pd.DataFrame) -> list[dict]:
    required = {"Gene", "Chrom", "Position", "RSID", "Genotype", "Diplotype", "Phenotype"}
    missing = required - set(df.columns)
    if missing:
        missing_str = ", ".join(sorted(missing))
        raise ValueError(f"Input DataFrame is missing required columns: {missing_str}")

    records: list[dict] = []

    for _, row in df.iterrows():
        gene = row["Gene"]
        chrom = row["Chrom"]
        position = row["Position"]
        rsid = row["RSID"]
        genotype = row["Genotype"]

        if genotype == "0/0":
            continue

        if rsid is None or pd.isna(rsid):
            continue

        star: str | None = None
        if "STAR" in df.columns:
            star_val = row.get("STAR")
            if star_val is not None and not pd.isna(star_val) and star_val not in ("", "."):
                star = str(star_val)

        if star is None:
            star = get_star_allele(gene, rsid)
        if star is None:
            continue

        allele_function = get_allele_function(gene, star)

        records.append(
            {
                "gene": str(gene),
                "rsid": str(rsid),
                "chrom": str(chrom),
                "position": int(position),
                "genotype": str(genotype),
                "star_allele": star,
                "allele_function": allele_function,
            }
        )

    return records


def build_detected_variants_json(df: pd.DataFrame) -> dict:
    return {"detected_variants": generate_detected_variants(df)}


if __name__ == "__main__":
    sample_data = {
        "Gene": ["CYP2C19", "CYP2C19", "CYP2D6"],
        "Chrom": ["chr10", "chr10", "chr22"],
        "Position": [94781859, 94781900, 42129045],
        "RSID": ["rs4244285", "rs12248560", "rs3892097"],
        "Genotype": ["0/1", "0/0", "1/1"],
        "Diplotype": ["*1/*2", "*1/*1", "*4/*4"],
        "Phenotype": ["IM", "NM", "PM"],
    }
    df = pd.DataFrame(sample_data)
    result = build_detected_variants_json(df)
    print(result)

