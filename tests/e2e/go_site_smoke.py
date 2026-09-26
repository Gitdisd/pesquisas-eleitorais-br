from pathlib import Path
import http.server
import os
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "go-pages"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def smoke(page, mobile=False):
    errors = []
    requests_failed = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("requestfailed", lambda req: requests_failed.append(f"{req.url} :: {req.failure}"))

    page.goto("http://127.0.0.1:4173/index.html", wait_until="networkidle")
    page.wait_for_selector("h1")
    assert "Pesquisas eleitorais" in page.locator("h1").inner_text()
    assert page.locator("#chart").count() == 1
    assert page.locator("svg").count() >= 1
    assert page.locator("table").count() >= 1
    assert page.locator("#round").count() == 1
    assert page.locator("#candidate").count() == 1
    assert page.locator("#geo").count() == 1
    assert page.locator("#institute").count() == 1
    assert page.locator("#model").count() == 1
    assert page.locator("#projection").count() == 1
    assert page.locator("#tableQuery").count() == 1

    page.select_option("#round", "2")
    page.select_option("#candidate", "Lula")
    page.select_option("#model", "2")
    page.locator("#projection").check()
    page.select_option("#round", "1")
    page.select_option("#model", "12")

    page.fill("#tableQuery", "Quaest")
    page.locator("#tableQuery").press("Tab")
    assert page.locator("table").count() >= 1

    institute = page.locator("[data-action='institute']").first
    if institute.count():
        institute.click()

    overlay = page.locator("[data-action='overlay']").first
    if overlay.count():
        overlay.click()

    page.locator("[data-action='hidden']").first.click()
    page.get_by_text("CSV", exact=True).click()
    page.get_by_text("JSON", exact=True).click()
    page.get_by_text("Copiar link", exact=True).click()

    page.wait_for_timeout(250)
    assert not any("net::ERR" in msg for msg in requests_failed), requests_failed
    assert not errors, errors

    # The rewrite intentionally does not carry the old Focus/Focar convenience action.
    assert page.get_by_text("focar", exact=False).count() == 0
    assert page.get_by_text("focus", exact=False).count() == 0

    if mobile:
        assert page.locator("#chart").bounding_box()["width"] > 0


def run():
    os.chdir(SITE)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 4173), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            desktop = browser.new_page(
                viewport={"width": 1440, "height": 900},
                permissions=["clipboard-read", "clipboard-write"],
            )
            smoke(desktop, mobile=False)
            desktop.close()

            mobile = browser.new_page(
                viewport={"width": 390, "height": 844},
                permissions=["clipboard-read", "clipboard-write"],
            )
            smoke(mobile, mobile=True)
            mobile.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
