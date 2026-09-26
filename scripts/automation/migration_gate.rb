#!/usr/bin/env ruby
# frozen_string_literal: true

# Migration gate: cheap repository-level checks before the expensive Rust/Dioxus build.
# Ruby stdlib only; this is orchestration/validation, not production application code.

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

required_file("rust/web-ui/Cargo.toml")
required_file(".github/workflows/deploy-pages.yml")
required_file("public/data/polls.json")
required_file("public/data/meta.json")
required_file("docs/CHANGELOG.md")

cargo = required_file("rust/web-ui/Cargo.toml").read
fail_gate("Dioxus 0.7.10 is not declared") unless cargo.match?(/dioxus\s*=\s*\{[^\n]*version\s*=\s*"0\.7\.10"/)

workflow = required_file(".github/workflows/deploy-pages.yml").read
fail_gate("Pages workflow does not build the Dioxus bundle") unless workflow.include?("dx bundle --web --release")
fail_gate("Pages workflow is still publishing a Vite dist directory") if workflow.match?(/vite|rm -rf dist|upload-pages-artifact.*dist/i)
fail_gate("Pages workflow lacks a WASM artifact gate") unless workflow.include?("find \"$DX_PUBLIC/assets\" -type f -name '*.wasm'")
fail_gate("Pages workflow lacks the production poll mirror gate") unless workflow.include?('test -f "$DX_PUBLIC/data/polls.json"')
fail_gate("Pages workflow lacks the production metadata mirror gate") unless workflow.include?('test -f "$DX_PUBLIC/data/meta.json"')

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

allowed_source_modules = %w[
  src/aggregate.js
  src/aggregate.ts
  src/candidates.js
  src/data/identity.js
  src/data/normalize.ts
  src/data/types.ts
  src/models/advanced.ts
  src/models/school.ts
  src/projection-v2.js
  src/projection.js
  src/stats/contract.js
  src/stats/estimator.js
  src/stats/house-effects.js
].sort

source_modules = Dir[ROOT.join("src/**/*.{js,ts}")].map { |path| Pathname.new(path).relative_path_from(ROOT).to_s }.sort
unexpected_source_modules = source_modules - allowed_source_modules
missing_allowed_modules = allowed_source_modules - source_modules
fail_gate("unexpected authored src JS/TS module(s): #{unexpected_source_modules.join(", ")}") unless unexpected_source_modules.empty?
fail_gate("expected offline/reference module(s) missing: #{missing_allowed_modules.join(", ")}") unless missing_allowed_modules.empty?

source_modules.each do |path|
  content = ROOT.join(path).read
  fail_gate("remaining src JS/TS looks browser-bound: #{path}") if content.match?(/(?:window\.(?:document|location|localStorage|fetch|addEventListener|setTimeout|setInterval|requestAnimationFrame|navigator)|(?:globalThis|self)\.|document\.|addEventListener\(|import\.meta\.env|querySelector\()/)
end

%w[
  src/aggregate.js
  src/aggregate.ts
  src/data/identity.js
  src/data/normalize.ts
  src/models/advanced.ts
  src/models/school.ts
  src/stats/contract.js
].each do |path|
  pass("offline/reference tooling retained: #{path}") if ROOT.join(path).file?
end

package = JSON.parse(required_file("package.json").read)
fail_gate("package.json still exposes a browser dev server") if package.fetch("scripts", {}).values.any? { |v| v.match?(/vite\s/) }

workflow_files = Dir[ROOT.join(".github/workflows/*.{yml,yaml}")]
workflow_legacy_hits = workflow_files.filter_map do |path|
  content = Pathname.new(path).read
  Pathname.new(path).relative_path_from(ROOT).to_s if content.match?(/npm run build(?!:)|\bvite\b|\becharts?\b/i)
end
fail_gate("workflow still references legacy browser build/tooling: #{workflow_legacy_hits.join(", ")}") unless workflow_legacy_hits.empty?

changelog = required_file("docs/CHANGELOG.md").read
fail_gate("migration validation status is not documented") unless changelog.include?("validation pending") || changelog.include?("Dioxus")

pass("required Rust/Dioxus, data, workflow, and documentation files exist")
pass("legacy browser entrypoints are absent")
pass("production Pages workflow is structurally guarded")
pass("offline tooling remains separate from the browser runtime")
puts("MIGRATION GATE: READY — continue to Rust/Dioxus compilation and browser validation")
