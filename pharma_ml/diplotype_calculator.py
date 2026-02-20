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


def _normalize_genotype(genotype: str) -> str:
    if not genotype or genotype == "./.":
        return "0/0"

    sep = "/" if "/" in genotype else "|" if "|" in genotype else None
    if sep is None:
        return "0/0"

    parts = genotype.split(sep)
    if len(parts) != 2:
        return "0/0"

    alleles: list[int] = []
    for p in parts:
        p = p.strip()
        if p == "." or p == "":
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


def _compute_gene_diplotype(gene_rows: pd.DataFrame, gene: str) -> str:
    star_map = STAR_DEFINITIONS.get(gene, {})
    if not star_map or gene_rows.empty:
        return "*1/*1"

    allele1 = "*1"
    allele2 = "*1"
    mutated_stars: list[str] = []

    for _, row in gene_rows.iterrows():
        rsid = row.get("RSID")
        genotype = row.get("Genotype")

        if rsid is None or pd.isna(rsid) or genotype is None or pd.isna(genotype):
            continue

        rsid_str = str(rsid)
        if rsid_str not in star_map:
            continue

        gt_norm = _normalize_genotype(str(genotype))
        if gt_norm == "0/0":
            continue

        star = star_map[rsid_str]
        if gt_norm == "1/1":
            allele1 = star
            allele2 = star
        elif gt_norm == "0/1":
            mutated_stars.append(star)

    if allele1 == "*1" and allele2 == "*1":
        if len(mutated_stars) == 1:
            allele2 = mutated_stars[0]
        elif len(mutated_stars) >= 2:
            allele1 = mutated_stars[0]
            allele2 = mutated_stars[1]

    return f"{allele1}/{allele2}"


def calculate_diplotype(df: pd.DataFrame) -> pd.DataFrame:
    required_cols = {"Gene", "Chrom", "Position", "RSID", "Genotype"}
    missing = required_cols - set(df.columns)
    if missing:
        missing_str = ", ".join(sorted(missing))
        raise ValueError(f"Input DataFrame is missing required columns: {missing_str}")

    result = df.copy()
    result["Diplotype"] = pd.NA

    for gene in PGX_GENES:
        mask = result["Gene"] == gene
        if not mask.any():
            continue

        gene_rows = result.loc[mask]
        diplotype = _compute_gene_diplotype(gene_rows, gene)
        result.loc[mask, "Diplotype"] = diplotype

    return result


def main() -> None:
    data: dict[str, list[Any]] = {
        "Gene": ["CYP2C19", "CYP2C19", "TPMT", "DPYD"],
        "Chrom": ["chr10", "chr10", "chr6", "chr1"],
        "Position": [94781859, 96541616, 18130687, 9791563],
        "RSID": ["rs4244285", "rs12248560", "rs1142345", "rs3918290"],
        "Genotype": ["0/1", "0/0", "0/0", "1/1"],
    }
    df = pd.DataFrame(data)
    result = calculate_diplotype(df)
    print(result)


if __name__ == "__main__":
    main()

