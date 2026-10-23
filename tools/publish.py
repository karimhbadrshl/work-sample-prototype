"""Publish the demo: public GitHub repo + GitHub Pages from main /docs, then fill in the live link.

  python tools/publish.py <repo-name>          e.g. python tools/publish.py shl-work-sample

Steps: build docs -> write the Pages URL into README.md and submission/writeup_content.py -> preflight ->
commit -> create the public repo if it doesn't exist (gh) and push -> enable Pages -> wait until live.
Needs the GitHub CLI logged in (gh auth status). Nothing private is pushed: preflight blocks it.
"""
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

REPO = pathlib.Path(__file__).resolve().parents[1]


def run(*cmd, check=True):
    print("$", " ".join(cmd))
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(r.stdout + r.stderr)
    return r


def main(name: str):
    user = run("gh", "api", "user", "--jq", ".login").stdout.strip()
    url = f"https://{user}.github.io/{name}/"
    repo_url = f"https://github.com/{user}/{name}"

    if not (REPO / ".git").exists():   # fresh starter folder: make it a repo on main
        run("git", "init", "-b", "main")
    run(sys.executable, "tools/build_game.py")
    readme = REPO / "README.md"
    readme.write_text(re.sub(r"https://REPLACE-ME[^)\s]*|https://[\w-]+\.github\.io/[\w.-]+/", url,
                             readme.read_text(encoding="utf-8")), encoding="utf-8")
    wc = REPO / "submission/writeup_content.py"
    if wc.exists():
        s = wc.read_text(encoding="utf-8")
        s = re.sub(r'DEMO_URL = ".*"', f'DEMO_URL = "{url}"', s)
        s = re.sub(r'REPO_URL = ".*"', f'REPO_URL = "{repo_url}"', s)
        wc.write_text(s, encoding="utf-8")

    run("git", "add", "-A")
    run(sys.executable, "tools/preflight.py")
    if run("git", "diff", "--cached", "--quiet", check=False).returncode:
        run("git", "commit", "-m", "Publish prototype and demo page")

    if run("gh", "repo", "view", f"{user}/{name}", check=False).returncode:
        run("gh", "repo", "create", name, "--public", "--source", ".", "--remote", "origin", "--push")
    else:
        run("git", "push", "-u", "origin", "HEAD:main")
        # The repo is created private ahead of the day; Pages on a free plan needs it public.
        vis = run("gh", "repo", "view", f"{user}/{name}", "--json", "visibility", "--jq", ".visibility").stdout.strip()
        if vis != "PUBLIC":
            run("gh", "repo", "edit", f"{user}/{name}", "--visibility", "public", "--accept-visibility-change-consequences")

    pages = run("gh", "api", f"repos/{user}/{name}/pages", check=False)
    if pages.returncode:
        run("gh", "api", "-X", "POST", f"repos/{user}/{name}/pages", "-f", "source[branch]=main", "-f", "source[path]=/docs")

    print("waiting for GitHub Pages ...")
    for _ in range(60):
        status = run("gh", "api", f"repos/{user}/{name}/pages", "--jq", ".status", check=False).stdout.strip()
        try:
            code = urllib.request.urlopen(url, timeout=10).status
        except Exception:
            code = 0
        if status == "built" and code == 200:
            print(f"\nLIVE: {url}\nRepo: {repo_url}\nNext: python tools/e2e_check.py {url}")
            return
        time.sleep(10)
    sys.exit(f"Pages not live after 10 minutes; check {repo_url}/settings/pages")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
