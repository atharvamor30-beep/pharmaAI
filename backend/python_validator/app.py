from flask import Flask, request, jsonify
import os

try:
    import pysam
except Exception:
    pysam = None

app = Flask(__name__)

REQUIRED_HEADER_COLS = ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO']
RECOMMENDED_INFO = ['GENE', 'RS', 'STAR']

@app.route('/', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json() or {}
    vcf_path = data.get('vcf_file_path')

    if not vcf_path or not isinstance(vcf_path, str):
        return jsonify({"vcf_parsing_success": False, "message": "Invalid VCF structure or corrupted file."}), 200

    if not os.path.isfile(vcf_path):
        return jsonify({"vcf_parsing_success": False, "message": "Invalid VCF structure or corrupted file."}), 200

    if pysam is None:
        return jsonify({"vcf_parsing_success": False, "message": "Server configuration error: pysam not installed."}), 500

    warnings = []

    try:
        # Attempt to open the file as a VCF/BCF
        vf = pysam.VariantFile(vcf_path)

        # Inspect header text for required columns
        header_text = str(vf.header)
        for col in REQUIRED_HEADER_COLS:
            if col not in header_text:
                return jsonify({"vcf_parsing_success": False, "message": "Invalid VCF structure or corrupted file."}), 200

        # Check for presence of recommended INFO fields by scanning header
        header_info = [line for line in header_text.splitlines() if line.startswith('##INFO')]
        info_keys = set()
        for info in header_info:
            # attempt to extract ID from e.g. ##INFO=<ID=GENE,Number=1,Type=String,Description="...">
            try:
                start = info.index('ID=') + 3
                rest = info[start:]
                key = rest.split(',')[0].strip()
                info_keys.add(key.upper())
            except Exception:
                continue

        missing = [k for k in RECOMMENDED_INFO if k not in info_keys]
        if missing:
            warnings.append(f"Missing INFO fields (warnings): {', '.join(missing)}")

        # Try reading a few records to ensure parsability
        parsed_any = False
        for i, rec in enumerate(vf):
            parsed_any = True
            # No need to iterate many; break early
            if i >= 4:
                break

        if not parsed_any:
            # it's possible a valid VCF contains only header but that's unexpected
            warnings.append('VCF contains no variant records; file parsed but contains no data')

        resp = {"vcf_parsing_success": True}
        if warnings:
            resp['warnings'] = warnings

        return jsonify(resp), 200

    except Exception as e:
        # Parsing error or malformed file
        return jsonify({"vcf_parsing_success": False, "message": "Invalid VCF structure or corrupted file."}), 200

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Simple VCF structural validator service')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()

    app.run(host=args.host, port=args.port)
