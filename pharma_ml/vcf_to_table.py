from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Union, Optional, Dict, Any

import pandas as pd
from cyvcf2 import VCF


def _resolve_vcf_path(vcf_file: Union[str, Path]) -> Path:
    """
    Resolve the VCF path.

    - If an absolute or relative path directly to a file is given, use it.
    - If only a filename is given, assume it lives under the local `VCF_File` folder.
    """
    vcf_path = Path(vcf_file)
    if vcf_path.is_absolute() or vcf_path.exists():
        return vcf_path

    base_dir = Path(__file__).resolve().parent
    candidate = base_dir / "VCF_File" / vcf_path.name
    return candidate


def _extract_primary_gene(info: Dict[str, Any]) -> Optional[str]:
    """
    Extract the primary gene name from the INFO field.
    Now uses only the standard GENE tag.
    """
    value = info.get("GENE")
    if value in (None, "", "."):
        return None
    return str(value)


def VCF_to_Table(vcf_file: Union[str, Path]):
    """
    Convert a VCF file to a tabular representation.

    Current implementation:
    - Reads the VCF using cyvcf2.
    - Produces a pandas DataFrame with a single column:
      * 'Primary_Gene': derived from INFO.GENE.

    Additional columns can be added later as requested.
    """
    vcf_path = _resolve_vcf_path(vcf_file)
    vcf = VCF(str(vcf_path))

    rows = []
    for record in vcf:
        primary_gene = _extract_primary_gene(record.INFO)
        rows.append(
            {
                "Primary_Gene": primary_gene,
            }
        )

    table = pd.DataFrame(rows)
    return table




PGX_GENES: frozenset[str] = frozenset(
    {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}
)


def _iter_gene_tokens(value: Any) -> Iterable[str]:
    """
    Turn a cyvcf2 INFO value into gene token(s), without regex parsing.

    cyvcf2 may return strings, lists/tuples, numbers, or None depending on header typing.
    """
    if value is None:
        return []

    if isinstance(value, (list, tuple)):
        items = value
    else:
        items = [value]

    for item in items:
        if item is None:
            continue
        text = str(item).strip()
        if not text or text == ".":
            continue

        # Split on common delimiters found in INFO tag values.
        for delimiter in (",", "|", "&", ";"):
            text = text.replace(delimiter, " ")

        for token in text.split():
            token = token.strip()
            if token:
                yield token


def _extract_gene(variant) -> str | None:
    """
    Return the pharmacogene name for this variant, if present in INFO.GENE.
    """
    info = getattr(variant, "INFO", None)
    if info is None:
        return None

    value = info.get("GENE")
    for token in _iter_gene_tokens(value):
        if token in PGX_GENES:
            return token
    return None


def _format_gt(variant) -> str:
    """
    Convert the first sample's GT into a VCF-like string (e.g., 0/1, 1|0, ./.).
    """
    gts = getattr(variant, "genotypes", None)
    if not gts:
        return "./."

    sample_gt = gts[0]
    if not sample_gt or len(sample_gt) < 3:
        return "./."

    a1, a2, phased = sample_gt[0], sample_gt[1], bool(sample_gt[2])
    sep = "|" if phased else "/"

    def allele_str(a: int) -> str:
        return "." if a is None or a < 0 else str(a)

    return f"{allele_str(a1)}{sep}{allele_str(a2)}"


def parse_pgx_vcf(vcf_path: str | Path) -> dict[str, list[dict[str, Any]]]:
    """
    Parse a (possibly gzipped) VCF and return pharmacogenomic variants grouped by gene.

    Rules:
    - Uses cyvcf2.VCF (no pandas).
    - Skips variants whose FILTER is not PASS.
    - Gene membership is read from INFO["PX"] or INFO["GENE"].
    - If none found, returns an empty dict.
    """
    path = Path(vcf_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"VCF path not found: {path}")

    results: dict[str, list[dict[str, Any]]] = {}
    from cyvcf2 import VCF

    vcf = VCF(str(path))  # supports .vcf and .vcf.gz

    for variant in vcf:
        # cyvcf2 uses None for PASS; some files may literally say "PASS"
        if variant.FILTER not in (None, "PASS"):
            continue

        gene = _extract_gene(variant)
        if gene is None:
            continue

        info = getattr(variant, "INFO", None)

        rsid_from_info = None
        if info is not None:
            rsid_from_info = info.get("RS")

        if rsid_from_info not in (None, "", "."):
            rsid = str(rsid_from_info)
        else:
            rsid = variant.ID if variant.ID and variant.ID != "." else None

        star = None
        if info is not None:
            star_val = info.get("STAR")
            if star_val not in (None, "", "."):
                star = str(star_val)

        record = {
            "rsid": rsid,
            "chrom": variant.CHROM,
            "position": int(variant.POS),
            "genotype": _format_gt(variant),
            "star": star,
        }
        results.setdefault(gene, []).append(record)

    return results


def json_to_dataframe(data: dict[str, Any]) -> "pd.DataFrame":
    import pandas as pd

    rows: list[dict[str, Any]] = []

    if not data:
        return pd.DataFrame(columns=["Gene", "Chrom", "Position", "RSID", "Genotype", "STAR"])

    for gene, variants in data.items():
        if not isinstance(variants, list):
            continue

        for variant in variants:
            if not isinstance(variant, dict):
                continue

            rsid = variant.get("rsid")
            star = variant.get("star")
            rows.append(
                {
                    "Gene": gene,
                    "Chrom": variant.get("chrom"),
                    "Position": variant.get("position"),
                    "RSID": rsid if rsid is not None else None,
                    "Genotype": variant.get("genotype"),
                    "STAR": star if star is not None else None,
                }
            )

    return pd.DataFrame(rows, columns=["Gene", "Chrom", "Position", "RSID", "Genotype", "STAR"])


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"JSON file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        loaded = json.load(f)

    if not isinstance(loaded, dict):
        raise ValueError("Top-level JSON must be an object mapping gene -> variants.")

    return loaded


def _pick_vcf_from_folder(folder: Path) -> Path:
    if not folder.exists() or not folder.is_dir():
        raise FileNotFoundError(f"VCF folder not found: {folder}")

    candidates = sorted(folder.glob("*.vcf")) + sorted(folder.glob("*.vcf.gz"))
    if not candidates:
        raise FileNotFoundError(f"No .vcf/.vcf.gz files found in: {folder}")
    return candidates[0]


def main() -> None:
    import argparse
    from phenotype_calculator import annotate_diplotype_phenotype

    parser = argparse.ArgumentParser(
        description="Parse PGx variants from VCF or JSON and print as a table."
    )
    source = parser.add_mutually_exclusive_group(required=False)
    source.add_argument(
        "--vcf",
        type=str,
        default=None,
        help="Path to a .vcf or .vcf.gz (default: first file in VCF_File/).",
    )
    source.add_argument(
        "--json",
        type=str,
        default=None,
        help="Path to a JSON file containing the pharmacogenomic structure.",
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Optional output CSV path to export the table.",
    )
    parser.add_argument(
        "--out-json",
        type=str,
        default=None,
        help="Optional output JSON path to export grouped PGx variants.",
    )
    args = parser.parse_args()

    try:
        if args.json:
            data = _load_json(Path(args.json))
        else:
            vcf_path = Path(args.vcf) if args.vcf else _pick_vcf_from_folder(Path("VCF_File"))
            data = parse_pgx_vcf(vcf_path)

        if args.out_json:
            out_path = Path(args.out_json)
            out_path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        df = json_to_dataframe(data)
        df = annotate_diplotype_phenotype(df)
        if df.empty:
            print("No pharmacogenomic variants found.")
            return

        print(df.to_string(index=False))

        if args.csv:
            csv_path = Path(args.csv)
            df.to_csv(csv_path, index=False)
            print(f"\nTable exported to CSV at: {csv_path}")
    except (FileNotFoundError, OSError, ValueError) as e:
        raise SystemExit(f"Error: {e}") from e


if __name__ == "__main__":
    main()

