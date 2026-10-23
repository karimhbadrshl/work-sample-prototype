"""End-to-end check in a real browser, plus screenshots for the Word write-up.

  python tools/e2e_check.py                      # tests docs/index.html opened as a file
  python tools/e2e_check.py https://<user>.github.io/<repo>/   # tests the published page

Uses the installed Google Chrome through Playwright (pip install -r requirements-dev.txt; no browser download).
Screenshots go to submission/screenshots/ (git-ignored), numbered to match the write-up placeholders.
"""
import pathlib
import re
import sys
import time

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parents[1]
SHOTS = REPO / "submission/screenshots"
sys.path.insert(0, str(REPO / "prototype"))
import config as C  # noqa: E402

# Which examples to show in screenshots: (drop-down label prefix, file name). Adjust per task.
SCENARIOS = [("g01", "02_scored_strong"), ("r_injection", "03_flagged_injection")]


def main(url: str):
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": 1400, "height": 1000}, color_scheme="light")
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
        t0 = time.time()
        pg.goto(url)
        pg.get_by_role("button", name=C.SUBMIT_LABEL).wait_for(timeout=180_000)
        print(f"ready after {time.time() - t0:.0f}s")
        pg.screenshot(path=SHOTS / "01_landing.png")
        for prefix, name in SCENARIOS:
            # The option list is virtualised (off-screen options don't exist yet), so filter by typing, then click.
            pg.get_by_role("combobox").first.click()
            pg.keyboard.type(prefix)
            before = pg.locator("textarea").first.input_value()
            pg.locator("[role='listbox']").get_by_text(f"{prefix}:", exact=False).first.click()
            # Streamlit reruns after each interaction; wait for the new example text before submitting.
            pg.wait_for_function("b => document.querySelector('textarea').value !== b", arg=before, timeout=15_000)
            pg.get_by_role("button", name=C.SUBMIT_LABEL).click()
            pg.get_by_text("Rationale:").wait_for(timeout=30_000)
            pg.wait_for_timeout(1500)   # let the recruiter view finish redrawing (stale results stay visible during a rerun)
            pg.screenshot(path=SHOTS / f"{name}.png")
            print(f"{name}: ok")
        for tab, marker, name in [("Evidence", "Quadratic weighted kappa", "04_evidence"), ("Approach", "Key decisions", "05_approach")]:
            pg.get_by_role("tab", name=tab).click()
            pg.get_by_text(marker).first.wait_for(timeout=10_000)
            pg.screenshot(path=SHOTS / f"{name}.png")
            print(f"{tab} tab: ok")
        b.close()
    print("console errors:", errors or "none")
    print(f"screenshots in {SHOTS.relative_to(REPO)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else (REPO / "docs/index.html").as_uri())
