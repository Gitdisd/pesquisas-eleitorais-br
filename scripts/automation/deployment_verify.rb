#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

base = URI(ARGV.fetch(0, "https://gitdisd.github.io/pesquisas-eleitorais-br/"))
raise "deployment URL must be HTTP(S)" unless %w[http https].include?(base.scheme)

def get(uri, redirects = 0)
  raise "too many redirects" if redirects > 5

  response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: 20) do |http|
    request = Net::HTTP::Get.new(uri.request_uri)
    request["Cache-Control"] = "no-cache"
    http.request(request)
  end

  return [response, uri] unless response.is_a?(Net::HTTPRedirection)

  location = response["location"]
  raise "redirect without Location from #{uri}" unless location
  get(URI.join(uri.to_s, location), redirects + 1)
end

def fetch_text(base, relative)
  response, uri = get(URI.join(base.to_s, relative))
  raise "#{relative}: HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)
  [response.body, uri]
end

last_error = nil
5.times do |attempt|
  begin
    index, index_uri = fetch_text(base, "")
    polls_text, polls_uri = fetch_text(base, "data/polls.json")
    meta_text, meta_uri = fetch_text(base, "data/meta.json")
    _extra_text, _extra_uri = fetch_text(base, "data/polls-extra.json")
    _regional_text, _regional_uri = fetch_text(base, "data/polls-regional.json")
    _wasm_text, _wasm_uri = fetch_text(base, "main.wasm")
    _runtime_text, _runtime_uri = fetch_text(base, "wasm_exec.js")

    polls = JSON.parse(polls_text)
    meta = JSON.parse(meta_text)

    raise "polls.json is not an array" unless polls.is_a?(Array)
    raise "meta.json is not an object" unless meta.is_a?(Hash)
    raise "record_count mismatch: #{meta["record_count"]} != #{polls.length}" unless meta["record_count"].to_i == polls.length
    raise "deployed page still references /src/main.js" if index.include?("/src/main.js")
    raise "deployed page still references Apache ECharts" if index.match?(/echarts/i)
    raise "deployed page does not contain the Go/WASM runtime marker" unless index.match?(/main\.wasm|wasm_exec\.js/i)

    puts "DEPLOYMENT VERIFY: PASS"
    puts "  index: #{index_uri}"
    puts "  polls: #{polls_uri} (#{polls.length} records)"
    puts "  meta:  #{meta_uri}"
    exit 0
  rescue StandardError => e
    last_error = e
    sleep 5 if attempt < 4
  end
end

warn "DEPLOYMENT VERIFY: FAIL — #{last_error}"
exit 1
