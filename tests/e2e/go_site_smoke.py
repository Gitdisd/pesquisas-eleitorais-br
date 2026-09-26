from pathlib import Path
import http.server
import os
import subprocess
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "go-pages"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run():
    os.chdir(SITE)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 4173), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto("http://127.0.0.1:4173/index.html", wait_until="networkidle")
            page.wait_for_selector("h1")
            assert "Pesquisas eleitorais" in page.locator("h1").inner_text()
            assert page.locator("table").count() == 1
            assert page.locator("svg").count() == 1
            assert page.locator("#round").count() == 1
            assert page.locator("#candidate").count() == 1
            assert page.locator("#geo").count() == 1
            assert page.locator("#institute").count() == 1
            page.select_option("#round", "1")
            page.wait_for_timeout(100)
            assert page.locator("table").count() == 1
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()

if __name__ == "__main__":
    run()
