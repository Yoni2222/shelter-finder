#!/usr/bin/env ruby
# Wires Firebase into the Capacitor iOS project.
#
# The Capacitor CLI regenerates parts of the project on `cap sync`, and it has
# no notion of Firebase, of our custom plugin sources, or of the notification
# extension. This script is idempotent - it is safe to run on every CI build.
#
#   1. Add the firebase-ios-sdk SPM package (FirebaseCore + FirebaseMessaging)
#   2. Add our hand-written Swift sources to the App target
#   3. Bundle GoogleService-Info.plist (FirebaseApp.configure crashes without it)
#   4. Embed the notification extension so it ships inside the .ipa

require 'xcodeproj'

FIREBASE_URL = 'https://github.com/firebase/firebase-ios-sdk.git'
FIREBASE_PRODUCTS = %w[FirebaseCore FirebaseMessaging]
APP_SOURCES = %w[FirebaseTopicsPlugin.swift ShelterNotificationHandler.swift]

project_path = File.join(__dir__, '..', 'client', 'ios', 'App', 'App.xcodeproj')
project = Xcodeproj::Project.open(project_path)

app_target = project.targets.find { |t| t.name == 'App' }
abort('ERROR: App target not found') if app_target.nil?

app_group = project.main_group.find_subpath('App', false)
abort('ERROR: App group not found') if app_group.nil?

# ── 1. Firebase SPM package ──────────────────────────────────────────────

pkg = project.root_object.package_references.find do |p|
  p.respond_to?(:repositoryURL) && p.repositoryURL == FIREBASE_URL
end

if pkg.nil?
  puts 'Adding firebase-ios-sdk package reference...'
  pkg = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
  pkg.repositoryURL = FIREBASE_URL
  pkg.requirement = {
    'kind' => 'upToNextMajorVersion',
    'minimumVersion' => '11.0.0'
  }
  project.root_object.package_references << pkg
else
  puts 'firebase-ios-sdk package reference already present.'
end

FIREBASE_PRODUCTS.each do |product|
  already = app_target.package_product_dependencies.any? { |d| d.product_name == product }
  if already
    puts "  #{product} already linked."
    next
  end

  puts "  Linking #{product}..."
  dep = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  dep.package = pkg
  dep.product_name = product
  app_target.package_product_dependencies << dep

  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = dep
  app_target.frameworks_build_phase.files << build_file
end

# ── 2. Custom Swift sources ──────────────────────────────────────────────

existing_sources = app_target.source_build_phase.files.map { |f| f.file_ref&.path }

APP_SOURCES.each do |filename|
  disk_path = File.join(__dir__, '..', 'client', 'ios', 'App', 'App', filename)
  unless File.exist?(disk_path)
    puts "  WARNING: #{filename} not found on disk, skipping."
    next
  end

  if existing_sources.include?(filename)
    puts "  #{filename} already in Sources."
    next
  end

  puts "  Adding #{filename} to Sources..."
  ref = app_group.files.find { |f| f.path == filename } || app_group.new_reference(filename)
  app_target.source_build_phase.add_file_reference(ref)
end

# ── 3. GoogleService-Info.plist ──────────────────────────────────────────

plist_name = 'GoogleService-Info.plist'
plist_on_disk = File.join(__dir__, '..', 'client', 'ios', 'App', 'App', plist_name)

if !File.exist?(plist_on_disk)
  puts "  WARNING: #{plist_name} missing - Firebase will crash at launch."
else
  in_resources = app_target.resources_build_phase.files.any? { |f| f.file_ref&.path == plist_name }
  if in_resources
    puts "  #{plist_name} already bundled."
  else
    puts "  Bundling #{plist_name}..."
    ref = app_group.files.find { |f| f.path == plist_name } || app_group.new_reference(plist_name)
    app_target.resources_build_phase.add_file_reference(ref)
  end
end

# ── 4. Embed the notification extension ──────────────────────────────────

ext_target = project.targets.find { |t| t.name == 'ShelterAlertExtension' }

if ext_target.nil?
  puts '  ShelterAlertExtension target not present yet (setup-ios-extension.rb runs first).'
else
  embed_phase = app_target.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }

  if embed_phase.nil?
    puts '  Creating Embed Foundation Extensions phase...'
    embed_phase = app_target.new_copy_files_build_phase('Embed Foundation Extensions')
    embed_phase.symbol_dst_subfolder_spec = :plug_ins
  end

  already_embedded = embed_phase.files.any? { |f| f.file_ref == ext_target.product_reference }

  if already_embedded
    puts '  Extension already embedded.'
  else
    puts '  Embedding ShelterAlertExtension...'
    build_file = embed_phase.add_file_reference(ext_target.product_reference)
    build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  end
end

project.save

puts ''
puts 'Firebase iOS setup complete.'
puts "Targets: #{project.targets.map(&:name).join(', ')}"
