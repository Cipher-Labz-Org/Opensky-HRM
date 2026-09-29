#!/usr/bin/env ruby
# frozen_string_literal: true

require "xcodeproj"

bundle_id = ENV.fetch("BUNDLE_ID")
team_id = ENV.fetch("APPLE_TEAM_ID")
profile_name = ENV.fetch("PROVISIONING_PROFILE_NAME")
scheme = ENV.fetch("XCODE_SCHEME")

project_path = File.join("ios", "#{scheme}.xcodeproj")
unless File.directory?(project_path)
  warn "ERROR: Xcode project not found: #{project_path}"
  exit 1
end

project = Xcodeproj::Project.open(project_path)
configured = 0

project.targets.each do |target|
  next unless target.respond_to?(:product_type)
  next unless target.product_type == "com.apple.product-type.application"

  puts "Configuring signing for target: #{target.name}"
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["CODE_SIGN_STYLE"] = "Manual"
    settings["DEVELOPMENT_TEAM"] = team_id
    settings["PRODUCT_BUNDLE_IDENTIFIER"] = bundle_id
    settings["PROVISIONING_PROFILE_SPECIFIER"] = profile_name
    settings["CODE_SIGN_IDENTITY"] = "Apple Distribution"
    settings["CODE_SIGN_IDENTITY[sdk=iphoneos*]"] = "Apple Distribution"
    configured += 1
  end
end

if configured.zero?
  warn "ERROR: No application target configured in #{project_path}"
  exit 1
end

project.save
puts "Configured #{configured} build configuration(s) for #{bundle_id}"
