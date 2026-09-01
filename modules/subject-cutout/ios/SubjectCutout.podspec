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

  # Optimise this pod even in Debug.
  #
  # The dev-client profile builds Debug, which means -Onone and bounds
  # checking on every array subscript. That is the right default for app code
  # and completely wrong for this module: the matte refinement and the
  # distance transform make roughly twenty full-resolution passes over a
  # couple of million pixels, and measured on device the same work took
  # 35 seconds unoptimised against well under a second at -O.
  #
  # The cost is that stepping through this pod in a debugger shows optimised
  # frames. Worth it — nobody can evaluate a cutout pipeline that takes half a
  # minute, and shipping only Release builds to test speed wastes EAS credits.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'SWIFT_OPTIMIZATION_LEVEL' => '-O',
    'GCC_OPTIMIZATION_LEVEL' => 's'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
