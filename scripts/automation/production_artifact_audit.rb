#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"

root = Pathname.new(ARGV.fetch(0) { exit 2 }).expand_path
raise "artifact directory missing: #{root}" unless root.directory?

required = %w[index.html data/polls.json data/meta.json]
required.each do |path|
  raise "missing production artifact file: #{path}" unless root.join(path).file?
end

index = root.join("index.html").read
raise "production artifact is missing the legacy application entrypoint" unless index.include?("/src/main.js")
raise "production artifact unexpectedly references the Dioxus migration shell" if index.match?(/dioxus/i)

polls = JSON.parse(root.join("data/polls.json").read)
meta = JSON.parse(root.join("data/meta.json").read)
raise "polls.json is not an array" unless polls.is_a?(Array)
raise "meta.record_count does not match polls.json" unless meta["record_count"].to_i == polls.length

js_assets = root.join("assets").glob("**/*.js")
raise "legacy production artifact contains no compiled JavaScript assets" if js_assets.empty?

puts "PRODUCTION ARTIFACT AUDIT: PASS — #{polls.length} polls, legacy entrypoint present, #{js_assets.length} JS asset(s)"
