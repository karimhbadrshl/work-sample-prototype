"""Check the repo is safe and ready to publish. Exits 1 on any problem.

  python tools/preflight.py

- no private files tracked or staged (notes, submission, references, .claude, CLAUDE.md, Word/PDF files)
- no API keys in tracked files
- docs/index.html exists and is newer than every file under prototype/
- README has a real demo link (no placeholder left)
"""
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parents[1]
PRIVATE = re.compile(r"^(notes/|submission/|references/|\.claude/|CLAUDE\.md$|START_HERE\.md$|\.env)|\.(docx|pdf|pptx)$", re.I)
KEY = re.compile(r"sk-ant-[A-Za-z0-9_-]{10,}|ANTHROPIC_API_KEY\s*=\s*['\"]?sk-")


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True).stdout


def main():
    problems = []
    # tracked files plus anything newly staged (ACMR = added/copied/modified/renamed; staged deletions are fine)
    tracked = set(git("ls-files").split("\n")) | set(git("diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n"))
    tracked.discard("")
    problems += [f"private file tracked: {f}" for f in sorted(tracked) if PRIVATE.search(f)]
    for f in tracked:
        p = REPO / f
        if p.is_file() and p.suffix in {".py", ".md", ".toml", ".json", ".txt", ".html", ".yml", ".yaml"}:
            if KEY.search(p.read_text(encoding="utf-8", errors="ignore")):
                problems.append(f"possible API key in {f}")
    html = REPO / "docs/index.html"
    if not html.exists():
        problems.append("docs/index.html missing: run python tools/build_static.py")
    else:
        newest = max(p.stat().st_mtime for p in (REPO / "prototype").rglob("*") if p.is_file() and "__pycache__" not in p.parts)
        if newest > html.stat().st_mtime:
            problems.append("docs/index.html is older than prototype/: run python tools/build_static.py")
    if "REPLACE-ME" in (REPO / "README.md").read_text(encoding="utf-8"):
        problems.append("README.md still has the REPLACE-ME demo link (tools/publish.py fills it)")
    cfg = (REPO / "prototype/config.py").read_text(encoding="utf-8")
    if re.search(r"^EXAMPLE_CONTENT\s*=\s*True", cfg, re.M):
        problems.append("prototype/config.py still has EXAMPLE_CONTENT = True (starter example not replaced)")
    for f in ["README.md", "DECISIONS.md", "prototype/APPROACH.md"]:
        p = REPO / f
        if p.exists() and "[EDIT" in p.read_text(encoding="utf-8"):
            problems.append(f"{f} still has [EDIT ...] placeholders")
    for p in problems:
        print("FAIL", p)
    print("preflight:", "OK" if not problems else f"{len(problems)} problem(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
