#!/usr/bin/env python3
"""Build the static GitHub Pages frontend without Node, Vite, TypeScript, or Dioxus."""

from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "go" / "web-ui"
OUT = ROOT / "go-pages"
DATA = APP / "data"

def run(*args, env=None):
    subprocess.run(list(args), cwd=APP, env=env, check=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)

    for name in ("polls.json", "meta.json"):
        shutil.copy2(ROOT / "data" / name, DATA / name)

    run("go", "fmt", "./...")
    env = dict(__import__("os").environ)
    env.update({"GOOS": "js", "GOARCH": "wasm"})
    run("go", "build", "-trimpath", "-ldflags=-s -w", "-o", str(OUT / "main.wasm"), env=env)

    goroot = subprocess.check_output(["go", "env", "GOROOT"], text=True).strip()
    wasm_exec = Path(goroot) / "lib" / "wasm" / "wasm_exec.js"
    if not wasm_exec.exists():
        raise SystemExit(f"Go WebAssembly runtime not found: {wasm_exec}")
    shutil.copy2(wasm_exec, OUT / "wasm_exec.js")

    (OUT / "index.html").write_text("""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pesquisas eleitorais — Presidência 2026</title>
</head>
<body>
  <main id="app">Carregando pesquisas…</main>
  <noscript>Este site requer WebAssembly habilitado no navegador.</noscript>
  <script src="wasm_exec.js"></script>
  <script>
    const go = new Go();
    WebAssembly.instantiateStreaming(fetch("main.wasm"), go.importObject)
      .then(result => go.run(result.instance));
  </script>
</body>
</html>
""", encoding="utf-8")

    shutil.copy2(ROOT / "data" / "polls.json", OUT / "polls.json")
    shutil.copy2(ROOT / "data" / "meta.json", OUT / "meta.json")
    print(f"Go Pages bundle: {OUT}")

if __name__ == "__main__":
    main()
