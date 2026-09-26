#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"

root = Pathname.new(ARGV.fetch(0) { exit 2 }).expand_path
fail "artifact directory missing: #{root}" unless root.directory?

required = %w[index.html 404.html data/polls.json data/meta.json data/polls-extra.json data/polls-regional.json]
required.each do |path|
  fail "missing Pages artifact file: #{path}" unless root.join(path).file?
end

assets = root.join("assets")
fail "missing Pages assets directory" unless assets.directory?
wasm = assets.glob("**/*.wasm")
fail "no WASM payload found under Pages assets" if wasm.empty?

polls = JSON.parse(root.join("data/polls.json").read)
meta = JSON.parse(root.join("data/meta.json").read)
fail "polls.json is not an array" unless polls.is_a?(Array)
fail "meta.record_count does not match polls.json" unless meta["record_count"].to_i == polls.length

index = root.join("index.html").read
fail "artifact still references legacy /src/main.js" if index.include?("/src/main.js")
fail "artifact still references Apache ECharts" if index.match?(/echarts/i)

puts "ARTIFACT AUDIT: PASS — #{polls.length} polls, #{wasm.length} WASM payload(s), required mirrors present"
