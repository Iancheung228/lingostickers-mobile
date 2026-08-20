import Accelerate
import Foundation

// ---------------------------------------------------------------------------
// Turning a segmentation mask into a matte.
//
// Vision's mask is smooth and roughly right; the true boundary is wherever the
// photograph actually changes. Two passes close that gap, and neither has an
// equivalent anywhere in the current server pipeline:
//
//   1. Guided filter — re-fits the alpha to the image's own local structure,
//      using the photo as the guide. Where alpha is already flat (deep inside
//      or outside the subject) the fit is a = 0, b = mean, so the interior is
//      left exactly alone; all the work happens in the transition band. This
//      is the standard way to lift a low-resolution mask onto a high-
//      resolution edge.
//
//   2. Colour decontamination — every partially transparent pixel is a blend
//      of the subject and the background it was photographed against. Leave it
//      alone and a red mug cut off a green tablecloth carries a green rim
//      into wherever it's pasted. Nobody consciously registers the tint;
//      everybody registers that the cutout looks stuck on. Solving the matting
//      equation for the foreground removes it.
//
// Both run subsampled (see `subsampleFactor`), which is what makes them
// affordable on a phone rather than merely correct.
// ---------------------------------------------------------------------------
enum MatteRefiner {

  /// Guided-filter regularisation. Small enough to preserve genuine edges,
  /// large enough that flat regions don't amplify sensor noise into the matte.
  private static let epsilon: Float = 1e-4

  /// Alpha floor used when dividing by alpha during decontamination. Below
  /// this the pixel is essentially invisible, and the recovered colour is
  /// numerically meaningless — but it still needs to be *something* sensible,
  /// because scaling and compositing interpolate those RGB values.
  private static let alphaFloor: Float = 0.05

  /// Both passes do their expensive work at 1/N scale.
  ///
  /// This is the fast guided filter (He & Sun, 2015), and it is a memory
  /// decision as much as a speed one. The textbook formulation holds around
  /// ten full-resolution Float planes live at once; at 1600px that is roughly
  /// 110MB of transient buffers on top of the image itself, which is a jetsam
  /// risk in an app that is also holding a camera session. Subsampling by 4
  /// cuts those intermediates to a sixteenth.
  ///
  /// Quality barely moves, because the two things computed at low resolution —
  /// the guided filter's per-window `a`/`b` coefficients, and the local
  /// background estimate — are both inherently smooth. The full-resolution
  /// image is still what they're finally *applied* to, so the output keeps
  /// every bit of its detail.
  private static let subsampleFactor = 4

  // -------------------------------------------------------------------------
  static func refine(_ image: inout PlanarImage) {
    let width = image.width
    let height = image.height
    guard width > 8, height > 8 else { return }

    let radius = guideRadius(width: width, height: height)
    let luma = luminance(image)

    image.a = guidedFilter(guide: luma, input: image.a, width: width, height: height, radius: radius)
    decontaminate(&image, radius: max(radius * 3, 6))
  }

  // -------------------------------------------------------------------------
  // Guided filter (He, Sun & Tang), fast variant.
  // -------------------------------------------------------------------------
  private static func guidedFilter(
    guide: [Float],
    input: [Float],
    width: Int,
    height: Int,
    radius: Int
  ) -> [Float] {
    let small = subsample(guide, width: width, height: height, factor: subsampleFactor)
    let smallInput = subsample(input, width: width, height: height, factor: subsampleFactor).data
    let sw = small.width
    let sh = small.height
    let smallGuide = small.data
    let smallRadius = max(1, radius / subsampleFactor)
    let n = sw * sh

    let meanGuide = boxBlur(smallGuide, width: sw, height: sh, radius: smallRadius)
    let meanInput = boxBlur(smallInput, width: sw, height: sh, radius: smallRadius)
    let correlationGuide = boxBlur(multiply(smallGuide, smallGuide), width: sw, height: sh, radius: smallRadius)
    let correlationCross = boxBlur(multiply(smallGuide, smallInput), width: sw, height: sh, radius: smallRadius)

    var slope = [Float](repeating: 0, count: n)
    var offset = [Float](repeating: 0, count: n)
    for i in 0..<n {
      let variance = correlationGuide[i] - meanGuide[i] * meanGuide[i]
      let covariance = correlationCross[i] - meanGuide[i] * meanInput[i]
      let a = covariance / (variance + epsilon)
      slope[i] = a
      offset[i] = meanInput[i] - a * meanGuide[i]
    }

    let meanSlope = upsample(
      boxBlur(slope, width: sw, height: sh, radius: smallRadius),
      width: sw, height: sh, toWidth: width, toHeight: height
    )
    let meanOffset = upsample(
      boxBlur(offset, width: sw, height: sh, radius: smallRadius),
      width: sw, height: sh, toWidth: width, toHeight: height
    )

    var out = [Float](repeating: 0, count: width * height)
    for i in 0..<(width * height) {
      out[i] = min(1, max(0, meanSlope[i] * guide[i] + meanOffset[i]))
    }
    return out
  }

  // -------------------------------------------------------------------------
  // Colour decontamination.
  //
  // Estimates the local background by blurring the image weighted by (1 - α)
  // — so only pixels that are actually background contribute — then solves the
  // matting equation C = αF + (1-α)B for F. At α = 1 this collapses to F = C,
  // so fully opaque pixels are mathematically untouched.
  // -------------------------------------------------------------------------
  private static func decontaminate(_ image: inout PlanarImage, radius: Int) {
    let width = image.width
    let height = image.height
    let count = width * height
    let smallRadius = max(1, radius / subsampleFactor)

    var inverseAlpha = [Float](repeating: 0, count: count)
    for i in 0..<count { inverseAlpha[i] = 1 - image.a[i] }

    let smallInverse = subsample(inverseAlpha, width: width, height: height, factor: subsampleFactor)
    let sw = smallInverse.width
    let sh = smallInverse.height
    let weight = boxBlur(smallInverse.data, width: sw, height: sh, radius: smallRadius)

    for channel in 0..<3 {
      let source = channelValues(image, channel)
      let smallSource = subsample(source, width: width, height: height, factor: subsampleFactor).data
      let weighted = boxBlur(
        multiply(smallSource, smallInverse.data), width: sw, height: sh, radius: smallRadius
      )

      // The background estimate, at low resolution, then lifted back up. It is
      // a smooth field by construction — this is exactly the quantity that
      // loses nothing to subsampling.
      var smallBackground = [Float](repeating: 0, count: sw * sh)
      for i in 0..<(sw * sh) {
        smallBackground[i] = weight[i] > 1e-4 ? weighted[i] / weight[i] : smallSource[i]
      }
      let background = upsample(
        smallBackground, width: sw, height: sh, toWidth: width, toHeight: height
      )

      var out = [Float](repeating: 0, count: count)
      for i in 0..<count {
        let alpha = image.a[i]
        // Nothing to recover where the pixel is already fully opaque.
        guard alpha < 0.999 else {
          out[i] = source[i]
          continue
        }
        let foreground = (source[i] - (1 - alpha) * background[i]) / max(alpha, alphaFloor)
        out[i] = min(1, max(0, foreground))
      }
      setChannelValues(&image, channel, out)
    }
  }

  // -------------------------------------------------------------------------
  // Resampling
  // -------------------------------------------------------------------------

  private static func subsample(
    _ source: [Float], width: Int, height: Int, factor: Int
  ) -> (data: [Float], width: Int, height: Int) {
    let outWidth = max(1, width / factor)
    let outHeight = max(1, height / factor)
    var out = [Float](repeating: 0, count: outWidth * outHeight)

    for y in 0..<outHeight {
      let y0 = y * factor
      let y1 = min(height, y0 + factor)
      for x in 0..<outWidth {
        let x0 = x * factor
        let x1 = min(width, x0 + factor)
        var sum: Float = 0
        var samples: Float = 0
        for sy in y0..<y1 {
          let offset = sy * width
          for sx in x0..<x1 {
            sum += source[offset + sx]
            samples += 1
          }
        }
        out[y * outWidth + x] = samples > 0 ? sum / samples : 0
      }
    }
    return (out, outWidth, outHeight)
  }

  private static func upsample(
    _ source: [Float], width: Int, height: Int, toWidth: Int, toHeight: Int
  ) -> [Float] {
    var out = [Float](repeating: 0, count: toWidth * toHeight)
    guard width > 0, height > 0 else { return out }

    let scaleX = Float(width) / Float(toWidth)
    let scaleY = Float(height) / Float(toHeight)

    for y in 0..<toHeight {
      let mappedY = min(Float(height - 1), max(0, (Float(y) + 0.5) * scaleY - 0.5))
      let y0 = Int(mappedY)
      let y1 = min(height - 1, y0 + 1)
      let weightY = mappedY - Float(y0)
      let row0 = y0 * width
      let row1 = y1 * width

      for x in 0..<toWidth {
        let mappedX = min(Float(width - 1), max(0, (Float(x) + 0.5) * scaleX - 0.5))
        let x0 = Int(mappedX)
        let x1 = min(width - 1, x0 + 1)
        let weightX = mappedX - Float(x0)

        let top = source[row0 + x0] * (1 - weightX) + source[row0 + x1] * weightX
        let bottom = source[row1 + x0] * (1 - weightX) + source[row1 + x1] * weightX
        out[y * toWidth + x] = top * (1 - weightY) + bottom * weightY
      }
    }
    return out
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /// Rec. 709 luma — the guide only needs to track structure, and a single
  /// channel keeps the guided filter to one set of box blurs instead of three.
  private static func luminance(_ image: PlanarImage) -> [Float] {
    var out = [Float](repeating: 0, count: image.count)
    for i in 0..<image.count {
      out[i] = 0.2126 * image.r[i] + 0.7152 * image.g[i] + 0.0722 * image.b[i]
    }
    return out
  }

  /// Scales with the image so the refinement covers a consistent *fraction* of
  /// the subject rather than a fixed pixel count — a 1600px capture and a
  /// 900px one should come out looking the same.
  private static func guideRadius(width: Int, height: Int) -> Int {
    let shortSide = min(width, height)
    return max(2, min(16, Int((Double(shortSide) * 0.004).rounded())))
  }

  private static func multiply(_ lhs: [Float], _ rhs: [Float]) -> [Float] {
    var out = [Float](repeating: 0, count: lhs.count)
    vDSP.multiply(lhs, rhs, result: &out)
    return out
  }

  private static func channelValues(_ image: PlanarImage, _ channel: Int) -> [Float] {
    switch channel {
    case 0: return image.r
    case 1: return image.g
    default: return image.b
    }
  }

  private static func setChannelValues(_ image: inout PlanarImage, _ channel: Int, _ values: [Float]) {
    switch channel {
    case 0: image.r = values
    case 1: image.g = values
    default: image.b = values
    }
  }

  /// Separable box blur with a sliding window — O(1) per pixel regardless of
  /// radius.
  ///
  /// Hand-rolled rather than delegated to Accelerate on purpose: vImage's box
  /// convolution only exists for 8-bit formats (`_Planar8`, `_ARGB8888`), and
  /// the float path it does offer, `vImageConvolve_PlanarF`, takes an explicit
  /// kernel and costs O(k²) per pixel. Quantising the matte to 8 bits to reach
  /// the fast path would throw away exactly the sub-level precision in the
  /// transition band that this whole file exists to recover.
  ///
  /// Edges clamp rather than darken, so the matte picks up no vignette at the
  /// frame border. The running sum is kept in Double: over thousands of
  /// accumulation steps, Float's ~7 significant digits visibly drift.
  static func boxBlur(_ source: [Float], width: Int, height: Int, radius: Int) -> [Float] {
    guard radius > 0, width > 0, height > 0 else { return source }

    let window = Double(radius * 2 + 1)
    var intermediate = [Float](repeating: 0, count: width * height)
    var output = [Float](repeating: 0, count: width * height)

    source.withUnsafeBufferPointer { input in
      intermediate.withUnsafeMutableBufferPointer { destination in
        for y in 0..<height {
          let row = y * width
          var sum = 0.0
          for k in -radius...radius {
            sum += Double(input[row + min(width - 1, max(0, k))])
          }
          destination[row] = Float(sum / window)
          guard width > 1 else { continue }
          for x in 1..<width {
            sum += Double(input[row + min(width - 1, x + radius)])
            sum -= Double(input[row + max(0, x - radius - 1)])
            destination[row + x] = Float(sum / window)
          }
        }
      }
    }

    intermediate.withUnsafeBufferPointer { input in
      output.withUnsafeMutableBufferPointer { destination in
        for x in 0..<width {
          var sum = 0.0
          for k in -radius...radius {
            sum += Double(input[min(height - 1, max(0, k)) * width + x])
          }
          destination[x] = Float(sum / window)
          guard height > 1 else { continue }
          for y in 1..<height {
            sum += Double(input[min(height - 1, y + radius) * width + x])
            sum -= Double(input[max(0, y - radius - 1) * width + x])
            destination[y * width + x] = Float(sum / window)
          }
        }
      }
    }

    return output
  }
}
