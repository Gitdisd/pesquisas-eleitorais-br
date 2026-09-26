#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"

ROOT = Pathname.new(__dir__).join("..", "..").realpath

def fail_gate(message)
  warn("MIGRATION GATE: FAIL — #{message}")
  exit 1
end

def pass(message)
  puts("MIGRATION GATE: PASS — #{message}")
end

def required_file(path)
  full = ROOT.join(path)
  fail_gate("missing required file: #{path}") unless full.file?
  full
end

required_file("go/web-ui/go.mod")
required_file("go/web-ui/main.go")
required_file("scripts/build_go_pages.py")
workflow = required_file(".github/workflows/deploy-pages.yml").read
required_file("public/data/polls.json")
required_file("public/data/meta.json")
required_file("docs/CHANGELOG.md")

fail_gate("Pages workflow still invokes Node/npm") if workflow.match?(/\bnpm\b|\bnode\b/i)
fail_gate("Pages workflow still invokes Rust/Cargo/Dioxus") if workflow.match?(/\bcargo\b|rustup|dioxus|\bdx /i)
fail_gate("Pages workflow still references Vite") if workflow.match?(/vite/i)
fail_gate("Pages workflow does not build the Go frontend") unless workflow.include?("python scripts/build_go_pages.py")
fail_gate("Pages workflow does not publish main.wasm") unless workflow.include?("pages-artifact/main.wasm")

go = required_file("go/web-ui/main.go").read
fail_gate("Go frontend has an authored JS/TypeScript import") if go.match?(/^\s*(?:import|require).*\.(?:js|ts)\b/i)
fail_gate("Go frontend does not embed canonical poll data") unless go.include?("polls.json")

legacy_browser_paths = %w[
  index.html
  vite.config.js
  src/main.js
  src/chart.js
  src/echarts-runtime.js
  src/style.css
]
legacy_browser_paths.each do |path|
  fail_gate("legacy browser entry remains: #{path}") if ROOT.join(path).exist?
end

source_modules = Dir[ROOT.join("src/**/*.{js,ts}")].map { |path| Pathname.new(path).relative_path_from(ROOT).to_s }
source_modules.each do |path|
  content = ROOT.join(path).read
  fail_gate("src JS/TS module still looks browser-bound: #{path}") if content.match?(/window\.|document\.|addEventListener\(|import\.meta\.env|querySelector\(/)
end

pass("Go/WebAssembly is the production browser runtime")
pass("Python owns research/statistical execution")
pass("Ruby owns migration/artifact validation")
pass("Pages workflow has no Node/Rust/Dioxus/Vite build dependency")
puts("MIGRATION GATE: READY — continue with Go browser validation")
