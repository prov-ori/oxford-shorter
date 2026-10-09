"""Extract source evidence without altering or publishing the PDF. No translation.
Usage: python tools/extract_pdf.py path/to/book.pdf --out tmp/source
Requires pypdf, available in the bundled workspace Python runtime.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

p = argparse.ArgumentParser()
p.add_argument('pdf', type=Path)
p.add_argument('--out', type=Path, default=Path('tmp/source'))
args = p.parse_args()
source = args.pdf.resolve()
target = args.out.resolve()
if target == source or source in target.parents:
    raise SystemExit('Output must be a separate directory')
target.mkdir(parents=True, exist_ok=True)
reader = PdfReader(source)
if reader.is_encrypted and reader.decrypt('') == 0:
    raise SystemExit('PDF is password-protected; provide an accessible copy')
sha = hashlib.sha256(source.read_bytes()).hexdigest()

def outline(items, level=1):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(outline(item, level + 1))
        else:
            try:
                page = reader.get_destination_page_number(item)
                result.append({'originalTitle': str(item.title), 'level': level,
                               'pdfPage': page + 1 if page is not None else None})
            except Exception as error:
                result.append({'originalTitle': str(item), 'level': level, 'error': str(error)})
    return result

metadata = {'filename': source.name, 'sha256': sha, 'pageCount': len(reader.pages),
            'outline': outline(reader.outline),
            'notice': 'Extracted text and bookmarks require visual verification. PDF page numbers are one-based.'}
(target / 'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
with (target / 'pages.jsonl').open('w', encoding='utf-8') as stream:
    for index, page in enumerate(reader.pages):
        text = page.extract_text(extraction_mode='layout') or ''
        stream.write(json.dumps({'pdfPage': index + 1, 'text': text, 'needsOCR': not text.strip()}, ensure_ascii=False) + '\n')
print(json.dumps({'pages': len(reader.pages), 'output': str(target), 'sha256': sha}))
