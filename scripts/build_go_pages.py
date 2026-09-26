#!/usr/bin/env python3
"""Build the Go/WebAssembly static site without Vite, Dioxus, or authored browser JS."""
from pathlib import Path
import os
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/"go"/"web-ui"
OUT=ROOT/"go-pages"
DATA=APP/"data"

def run(*args,env=None):
    subprocess.run(list(args),cwd=APP,env=env,check=True)

def main():
    OUT.mkdir(parents=True,exist_ok=True); DATA.mkdir(parents=True,exist_ok=True)
    for name in ("polls.json","meta.json","polls-extra.json","polls-regional.json"):
        src=ROOT/"public"/"data"/name
        if not src.exists(): src=ROOT/"data"/name
        if src.exists(): shutil.copy2(src,DATA/name)
    run("go","fmt","./...")
    env=os.environ.copy(); env.update({"GOOS":"js","GOARCH":"wasm"})
    run("go","build","-trimpath","-ldflags=-s -w","-o",str(OUT/"main.wasm"),env=env)
    goroot=Path(subprocess.check_output(["go","env","GOROOT"],text=True).strip())
    candidates=[goroot/"lib"/"wasm"/"wasm_exec.js",goroot/"misc"/"wasm"/"wasm_exec.js"]
    wasm_exec=next((p for p in candidates if p.exists()),None)
    if wasm_exec is None: raise SystemExit("Go WebAssembly runtime not found: "+"; ".join(map(str,candidates)))
    shutil.copy2(wasm_exec,OUT/"wasm_exec.js")
    index="""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f172a"><title>Pesquisas eleitorais — Presidência 2026</title>
</head>
<body style="margin:0;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
<main id="app" style="min-height:100vh;padding:24px;box-sizing:border-box">
  <div style="max-width:1180px;margin:auto;border:1px solid #334155;border-radius:14px;padding:24px;background:#1e293b">
    <div style="font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">PESQUISAS ELEITORAIS BR</div>
    <h1 style="margin:.35rem 0">Presidência 2026</h1>
    <p style="color:#cbd5e1">Carregando o painel de pesquisas…</p>
    <progress style="width:100%;height:8px" aria-label="Carregando"></progress>
    <p style="color:#94a3b8;font-size:.9rem">O painel estatístico está iniciando.</p>
  </div>
</main>
<noscript><p>Este site requer WebAssembly habilitado no navegador.</p></noscript>
<script src="wasm_exec.js"></script>
<script>
(async()=>{
  try {
    const go=new Go();
    const response=await fetch("main.wasm");
    const bytes=await response.arrayBuffer();
    const result=await WebAssembly.instantiate(bytes,go.importObject);
    go.run(result.instance);
  } catch (err) {
    document.getElementById("app").innerHTML="<main style='max-width:700px;margin:12vh auto;padding:24px'><h1>Não foi possível iniciar o painel</h1><p>Atualize a página e tente novamente.</p></main>";
    console.error(err);
  }
})();
</script>
</body></html>
"""
    (OUT/"index.html").write_text(index,encoding="utf-8"); shutil.copy2(OUT/"index.html",OUT/"404.html")
    (OUT/"data").mkdir(parents=True,exist_ok=True)
    for name in ("polls.json","meta.json","polls-extra.json","polls-regional.json"):
        src=DATA/name
        if src.exists(): shutil.copy2(src,OUT/"data"/name)
    print(f"Go Pages bundle: {OUT}")

if __name__=="__main__": main()
