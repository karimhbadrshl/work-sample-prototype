"""Print Karim's planning notes (notes/PLANNING_NOTES.docx) as plain text, headings marked with #.

  python tools/read_notes.py [path]

Claude runs this at the start of the session (Phase 0). Tables are printed row by row.
"""
import pathlib
import sys

from docx import Document

REPO = pathlib.Path(__file__).resolve().parents[1]


def main(path: pathlib.Path):
    if not path.exists():
        sys.exit(f"No notes file at {path}. Run: python tools/make_notes_template.py")
    doc = Document(path)
    body = doc.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            from docx.text.paragraph import Paragraph
            p = Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue
            style = p.style.name if p.style is not None else ""
            level = int(style.split()[-1]) if style.startswith("Heading") and style.split()[-1].isdigit() else 0
            print(("#" * level + " " if level else "") + text)
        elif tag == "tbl":
            from docx.table import Table
            for row in Table(child, doc).rows:
                print(" | ".join(c.text.strip() for c in row.cells))
    print()


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "notes/PLANNING_NOTES.docx")
