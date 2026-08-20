Pod::Spec.new do |s|
  s.name           = 'SubjectCutout'
  s.version        = '1.0.0'
  s.summary        = 'On-device subject segmentation and sticker styling via Apple Vision.'
  s.description    = 'Wraps VNGenerateForegroundInstanceMaskRequest with lasso-driven instance selection, matte refinement, colour decontamination and a distance-field sticker outline.'
  s.author         = ''
  s.homepage       = 'https://tabistickers.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
