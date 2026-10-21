# Builds only a small XCTest UI runner. The original App is already installed.
# Run on Mac with the xcodeproj gem provided by the existing CocoaPods install.
require 'xcodeproj'
require 'fileutils'
require 'pathname'

root = File.expand_path('../..', __dir__)
output = File.join(root, '.local', 'apple-intake-ui')
FileUtils.mkdir_p(output)
path = File.join(output, 'AppleIntakeUITests.xcodeproj')
project = File.exist?(path) ? Xcodeproj::Project.open(path) : Xcodeproj::Project.new(path)
target = project.targets.find { |item| item.name == 'AppleIntakeUITests' } ||
  project.new_target(:ui_test_bundle, 'AppleIntakeUITests', :ios, '16.4')
source = Pathname.new(File.join(__dir__, 'AppleIntakeUITests.swift')).relative_path_from(Pathname.new(output)).to_s
reference = project.files.find { |file| file.path == source } || project.main_group.new_file(source)
target.source_build_phase.add_file_reference(reference, true)
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.nccugrouping.AppleIntakeUITests',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.9',
    'IPHONEOS_DEPLOYMENT_TARGET' => '16.4',
    'SUPPORTED_PLATFORMS' => 'iphoneos',
    'SDKROOT' => 'iphoneos',
    'TARGETED_DEVICE_FAMILY' => '1',
    'ENABLE_TESTING_SEARCH_PATHS' => 'YES',
    'CODE_SIGN_STYLE' => 'Automatic',
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' => 'YES',
    'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Release'
scheme.save_as(path, 'AppleIntakeUITests', true)
puts path
