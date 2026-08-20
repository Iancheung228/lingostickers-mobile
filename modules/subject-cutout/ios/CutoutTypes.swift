import Foundation

// ---------------------------------------------------------------------------
// Failure taxonomy
//
// Every reason here is a *gate* decision, not a crash: the caller reads the
// reason and routes to the existing server cutout. They're kept as distinct
// cases (rather than one "failed") because the whole point of the confidence
// gate is knowing *why* the device declined — the mix of reasons over real
// scans is what tells us whether the thresholds are set right.
// ---------------------------------------------------------------------------
enum CutoutFailure: String {
  /// Below iOS 17 — VNGenerateForegroundInstanceMaskRequest doesn't exist.
  case unsupportedOS = "unsupported-os"
  /// Vision's segmentation models aren't present on the Simulator.
  case simulator = "simulator"
  /// The file URI couldn't be decoded into an image.
  case loadFailed = "load-failed"
  /// Vision threw while running the request.
  case visionFailed = "vision-failed"
  /// Vision ran but found no foreground objects at all. The common failure:
  /// low-contrast subjects, flat surfaces (signs, labels), subject filling
  /// the frame.
  case noInstances = "no-instances"
  /// Vision found objects, but none of them agree with what the user circled
  /// — either they sprawl outside the selection or they're a speck inside it.
  case noMatchingInstance = "no-matching-instance"
  /// A mask was produced but it's unusable: almost nothing kept, or almost
  /// everything kept (nothing was actually separated).
  case degenerateMask = "degenerate-mask"
  /// The final PNG couldn't be written.
  case encodeFailed = "encode-failed"
}

struct CutoutError: Error {
  let failure: CutoutFailure
  let detail: String?
  /// Diagnostics carried through even on failure, so the gate's decisions are
  /// measurable in production rather than opaque.
  var instanceCount: Int = 0
  var bestContainment: Double = 0
  var bestCoverage: Double = 0

  init(_ failure: CutoutFailure, _ detail: String? = nil) {
    self.failure = failure
    self.detail = detail
  }
}

/// A point in the *source image's* own pixel coordinate space.
struct CutoutPoint {
  let x: Double
  let y: Double
}

// ---------------------------------------------------------------------------
// Planar working buffers
//
// Everything after Vision runs on planar Float32 channels rather than
// interleaved bytes: vImage's box convolutions (the workhorse of both the
// guided filter and the decontamination pass) operate on PlanarF, and keeping
// one representation end-to-end avoids repeated interleave/deinterleave.
// ---------------------------------------------------------------------------
struct PlanarImage {
  var width: Int
  var height: Int
  /// Red, green, blue, each `width * height` long, 0...1.
  var r: [Float]
  var g: [Float]
  var b: [Float]
  /// Alpha, `width * height` long, 0...1.
  var a: [Float]

  var count: Int { width * height }

  init(width: Int, height: Int) {
    self.width = width
    self.height = height
    let n = width * height
    self.r = [Float](repeating: 0, count: n)
    self.g = [Float](repeating: 0, count: n)
    self.b = [Float](repeating: 0, count: n)
    self.a = [Float](repeating: 0, count: n)
  }

  init(width: Int, height: Int, r: [Float], g: [Float], b: [Float], a: [Float]) {
    self.width = width
    self.height = height
    self.r = r
    self.g = g
    self.b = b
    self.a = a
  }
}
