#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"

root = Pathname.new(ARGV.fetch(0) { exit 2 }).expand_path
fail "artifact directory missing: #{root}" unless root.directory?

required = %w[
  index.html
  404.html
  main.wasm
  wasm_exec.js
  data/polls.json
  data/meta.json
  data/polls-extra.json
  data/polls-regional.json
]
required.each do |path|
  fail "missing Pages artifact file: #{path}" unless root.join(path).file?
end

polls = JSON.parse(root.join("data/polls.json").read)
meta = JSON.parse(root.join("data/meta.json").read)
fail "polls.json is not an array" unless polls.is_a?(Array)
fail "meta.record_count does not match polls.json" unless meta["record_count"].to_i == polls.length

index = root.join("index.html").read
fail "artifact references Dioxus" if index.match?(/dioxus|dx-|rsx/i)
fail "artifact references Apache ECharts" if index.match?(/echarts/i)
fail "artifact references legacy browser entrypoint" if index.match?(/src/main.js|vite/i)

wasm_size = root.join("main.wasm").size
fail "WASM payload is empty" unless wasm_size.positive?

puts "ARTIFACT AUDIT: PASS — #{polls.length} polls, Go WASM #{wasm_size} bytes, required mirrors present"
