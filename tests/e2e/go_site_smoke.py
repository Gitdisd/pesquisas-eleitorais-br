from pathlib import Path
import http.server
import os
import threading
import time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/"go-pages"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,format,*args): pass

def run():
    os.chdir(SITE)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",4173),QuietHandler)
    thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start(); time.sleep(.5)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch()
            page=browser.new_page(viewport={"width":1440,"height":900})
            errors=[]; page.on("pageerror",lambda exc:errors.append(str(exc)))
            page.goto("http://127.0.0.1:4173/index.html",wait_until="networkidle")
            page.wait_for_selector("h1")
            assert "Pesquisas eleitorais" in page.locator("h1").inner_text()
            assert page.locator("#chart").count()==1
            assert page.locator("#regionalChart").count() in (0,1)
            assert page.locator("#round").count()==1 and page.locator("#model").count()==1
            assert page.locator("#tableQuery").count()==1
            page.select_option("#round","2"); page.select_option("#model","3")
            page.select_option("#model","1"); page.fill("#tableQuery","Quaest"); page.locator("#tableQuery").press("Tab")
            assert page.locator("table").count()>=1
            page.locator("[data-action='hidden']").first.click()
            page.locator("[data-action='overlay']").first.click()
            page.locator("#projection").check()
            page.get_by_text("CSV",exact=True).click()
            assert page.get_by_text("focar",exact=False).count()==0
            assert page.get_by_text("focus",exact=False).count()==0
            assert not errors,errors
            browser.close()
    finally: server.shutdown()

if __name__=="__main__": run()
