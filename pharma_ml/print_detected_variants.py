from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from detected_variants import build_detected_variants_json
from phenotype_calculator import annotate_diplotype_phenotype
from vcf_to_table import json_to_dataframe, parse_pgx_vcf


def _pick_vcf_from_folder(folder: Path) -> Path:
    if not folder.exists() or not folder.is_dir():
        raise FileNotFoundError(f"VCF folder not found: {folder}")

    candidates = sorted(folder.glob("*.vcf")) + sorted(folder.glob("*.vcf.gz"))
    if not candidates:
        raise FileNotFoundError(f"No .vcf/.vcf.gz files found in: {folder}")
    return candidates[0]


def build_annotated_dataframe(vcf_path: Path | None = None) -> pd.DataFrame:
    if vcf_path is None:
        vcf_path = _pick_vcf_from_folder(Path("VCF_File"))

    data = parse_pgx_vcf(vcf_path)
    df = json_to_dataframe(data)
    df = annotate_diplotype_phenotype(df)
    return df


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run PGx parsing pipeline and print detected_variants JSON."
    )
    parser.add_argument(
        "--vcf",
        type=str,
        default=None,
        help="Path to a .vcf or .vcf.gz (default: first file in VCF_File/).",
    )
    args = parser.parse_args()

    vcf_path = Path(args.vcf) if args.vcf else None
    df = build_annotated_dataframe(vcf_path)
    detected = build_detected_variants_json(df)
    print(json.dumps(detected, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

