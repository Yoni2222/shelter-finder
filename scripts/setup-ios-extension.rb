#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'client', 'ios', 'App', 'App.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Check if extension target already exists
if project.targets.any? { |t| t.name == 'ShelterAlertExtension' }
  puts "ShelterAlertExtension target already exists, skipping."
  exit 0
end

puts "Adding ShelterAlertExtension target..."

# Create the extension target
ext_target = project.new_target(
  :app_extension,
  'ShelterAlertExtension',
  :ios,
  '15.0'
)

# Set bundle identifier and other build settings
ext_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.shelterfinder.il.ShelterAlertExtension'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['INFOPLIST_FILE'] = '$(SRCROOT)/App/ShelterAlertExtension/Info.plist'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = '$(SRCROOT)/App/ShelterAlertExtension/ShelterAlertExtension.entitlements'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['MARKETING_VERSION'] = '1.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

# Find or create the extension group
ext_group = project.main_group.find_subpath('ShelterAlertExtension', true)
ext_group.set_source_tree('SOURCE_ROOT')
ext_group.set_path('App/ShelterAlertExtension')

# Add source file
swift_ref = ext_group.new_reference('NotificationService.swift')
ext_target.source_build_phase.add_file_reference(swift_ref)

# Add Info.plist (file reference only, not in build phase)
info_ref = ext_group.new_reference('Info.plist')

# Add entitlements (file reference only)
ent_ref = ext_group.new_reference('ShelterAlertExtension.entitlements')

# Add all-shelters.json to extension resources
# Create reference to the existing file in App/Resources
shelters_path = 'App/Resources/all-shelters.json'
shelters_ref = project.main_group.find_subpath('App', false)&.find_subpath('Resources', false)&.files&.find { |f| f.path == 'all-shelters.json' }

if shelters_ref.nil?
  resources_group = project.main_group.find_subpath('App/Resources', true)
  shelters_ref = resources_group.new_reference('all-shelters.json')
end

ext_target.resources_build_phase.add_file_reference(shelters_ref)

# Also update main app target entitlements
main_target = project.targets.find { |t| t.name == 'App' }
if main_target
  main_target.build_configurations.each do |config|
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  end

  # Add extension as dependency
  main_target.add_dependency(ext_target)
end

# Add frameworks needed by the extension
# UserNotifications and CoreLocation are system frameworks
['UserNotifications', 'CoreLocation'].each do |fw_name|
  fw_ref = project.frameworks_group.new_reference("System/Library/Frameworks/#{fw_name}.framework")
  fw_ref.name = "#{fw_name}.framework"
  fw_ref.source_tree = 'SDKROOT'
  ext_target.frameworks_build_phase.add_file_reference(fw_ref)
end

project.save

puts "ShelterAlertExtension target added successfully!"
puts "Targets: #{project.targets.map(&:name).join(', ')}"
