Pod::Spec.new do |s|
  s.name = 'NCCUAppleIntake'
  s.version = '0.1.0'
  s.summary = 'Project-local Apple on-device interview drafts'
  s.description = 'Summaries and questions only; no account, server, embeddings or consent.'
  s.license = { :type => 'Private' }
  s.author = 'NCCU Grouping'
  s.homepage = 'https://developer.apple.com/documentation/foundationmodels'
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.weak_frameworks = 'FoundationModels'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
