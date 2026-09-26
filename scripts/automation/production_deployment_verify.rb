#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

base = URI(ARGV.fetch(0))
raise "deployment URL must be HTTP(S)" unless %w[http https].include?(base.scheme)

def fetch(base, relative)
  uri = URI.join(base.to_s, relative)
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: 20) do |http|
    req = Net::HTTP::Get.new(uri.request_uri)
    req["Cache-Control"] = "no-cache"
    http.request(req)
  end
  raise "#{relative}: HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)
  response.body
end

index = fetch(base, "")
polls = JSON.parse(fetch(base, "data/polls.json"))
meta = JSON.parse(fetch(base, "data/meta.json"))

raise "deployed site is missing legacy /src/main.js" unless index.include?("/src/main.js")
raise "deployed site unexpectedly references Dioxus" if index.match?(/dioxus/i)
raise "polls.json is not an array" unless polls.is_a?(Array)
raise "record_count mismatch" unless meta["record_count"].to_i == polls.length

puts "PRODUCTION DEPLOYMENT VERIFY: PASS — legacy entrypoint and #{polls.length} published polls confirmed"
