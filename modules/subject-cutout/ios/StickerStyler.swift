import Foundation

// ---------------------------------------------------------------------------
// Turning a matte into a sticker.
//
// The outline is the visible signature of this whole change. The server draws
// it by unioning a horizontal and a vertical line dilation, which is not a
// rotation-invariant structuring element — the stroke comes out measurably
// thicker on axis-aligned edges than on diagonals, so on anything curved it
// visibly breathes as it travels around the contour. And because its input is
// a hard alpha threshold, it's aliased.
//
// Here the stroke comes from an exact Euclidean distance field instead. Every
// point at distance d from the subject gets the same treatment regardless of
// which direction it lies in, which is the definition of a uniform stroke, and
// feathering across one pixel of that field is anti-aliasing for free.
// ---------------------------------------------------------------------------
enum StickerStyler {

  /// Stroke width as a fraction of the trimmed subject's long side. Chosen to
  /// land on the server's existing look: its fixed 14px stroke sat on a
  /// roughly 600px trimmed subject, i.e. about 2.3%. Keeping it proportional
  /// (rather than a fixed pixel count) is what makes the stroke weight
  /// consistent now that the working resolution is no longer pinned to 800px.
  private static let borderRatio: Double = 0.022
  private static let minBorderWidth = 6
  private static let maxBorderWidth = 64

  /// Alpha above which a pixel counts as "content" when trimming. Deliberately
  /// low: the matte legitimately carries wispy detail down near zero, and
  /// cropping it off would undo the refinement pass.
  private static let trimThreshold: Float = 0.02
  private static let trimMarginRatio: Double = 0.02

  /// Alpha at which the outline's contour is taken. Half-coverage is the
  /// conventional isoline; translucent fringe below it lets the white backing
  /// show through, which is what a real die-cut sticker does too.
  private static let contourLevel: Float = 0.5

  // -------------------------------------------------------------------------
  static func style(_ image: PlanarImage, outputMaxDimension: Int) -> PlanarImage {
    let trimmed = trimToContent(image)
    let longSide = max(trimmed.width, trimmed.height)
    let borderWidth = max(
      minBorderWidth,
      min(maxBorderWidth, Int((Double(longSide) * borderRatio).rounded()))
    )

    let padded = pad(trimmed, by: borderWidth + 2)
    let outlined = applyOutline(padded, borderWidth: borderWidth)
    return downsample(outlined, maxDimension: outputMaxDimension)
  }

  // -------------------------------------------------------------------------
  // Trim
  //
  // The user's box or lasso isn't centred on the object, so the matte can sit
  // lopsided in its own canvas — and every screen in the app centres the whole
  // canvas rather than the subject inside it.
  // -------------------------------------------------------------------------
  private static func trimToContent(_ image: PlanarImage) -> PlanarImage {
    var minX = image.width, maxX = -1, minY = image.height, maxY = -1
    for y in 0..<image.height {
      let row = y * image.width
      for x in 0..<image.width where image.a[row + x] > trimThreshold {
        if x < minX { minX = x }
        if x > maxX { maxX = x }
        if y < minY { minY = y }
        if y > maxY { maxY = y }
      }
    }
    guard maxX >= minX, maxY >= minY else { return image }

    let margin = Int((Double(max(maxX - minX + 1, maxY - minY + 1)) * trimMarginRatio).rounded())
    let x0 = max(0, minX - margin)
    let y0 = max(0, minY - margin)
    let x1 = min(image.width - 1, maxX + margin)
    let y1 = min(image.height - 1, maxY + margin)
    return crop(image, x0: x0, y0: y0, width: x1 - x0 + 1, height: y1 - y0 + 1)
  }

  private static func crop(_ image: PlanarImage, x0: Int, y0: Int, width: Int, height: Int) -> PlanarImage {
    var out = PlanarImage(width: width, height: height)
    for y in 0..<height {
      let source = (y + y0) * image.width + x0
      let destination = y * width
      for x in 0..<width {
        out.r[destination + x] = image.r[source + x]
        out.g[destination + x] = image.g[source + x]
        out.b[destination + x] = image.b[source + x]
        out.a[destination + x] = image.a[source + x]
      }
    }
    return out
  }

  /// Transparent margin so the stroke has somewhere to land.
  private static func pad(_ image: PlanarImage, by amount: Int) -> PlanarImage {
    let width = image.width + amount * 2
    let height = image.height + amount * 2
    var out = PlanarImage(width: width, height: height)
    for y in 0..<image.height {
      let source = y * image.width
      let destination = (y + amount) * width + amount
      for x in 0..<image.width {
        out.r[destination + x] = image.r[source + x]
        out.g[destination + x] = image.g[source + x]
        out.b[destination + x] = image.b[source + x]
        out.a[destination + x] = image.a[source + x]
      }
    }
    return out
  }

  // -------------------------------------------------------------------------
  // Outline
  // -------------------------------------------------------------------------
  private static func applyOutline(_ image: PlanarImage, borderWidth: Int) -> PlanarImage {
    let width = image.width
    let height = image.height
    let n = width * height
    let colour = pickBorderColour(image)

    // A light blur before thresholding takes the jitter out of the contour
    // without touching the subject's own alpha — the stroke follows a settled
    // path while wispy detail inside the subject survives intact.
    let smoothingRadius = max(1, borderWidth / 6)
    let smoothed = MatteRefiner.boxBlur(image.a, width: width, height: height, radius: smoothingRadius)

    var seed = [Float](repeating: 0, count: n)
    let infinity: Float = 1e20
    for i in 0..<n {
      seed[i] = smoothed[i] >= contourLevel ? 0 : infinity
    }
    let squaredDistance = euclideanDistanceTransform(seed, width: width, height: height)

    var out = PlanarImage(width: width, height: height)
    let edge = Float(borderWidth)
    for i in 0..<n {
      let distance = sqrt(squaredDistance[i])
      // One pixel of feather centred on the stroke's outer edge.
      let strokeCoverage = min(1, max(0, edge + 0.5 - distance))
      let subjectAlpha = image.a[i]
      let behind = strokeCoverage * (1 - subjectAlpha)
      let alpha = subjectAlpha + behind

      out.a[i] = alpha
      guard alpha > 1e-5 else { continue }
      out.r[i] = (image.r[i] * subjectAlpha + colour.0 * behind) / alpha
      out.g[i] = (image.g[i] * subjectAlpha + colour.1 * behind) / alpha
      out.b[i] = (image.b[i] * subjectAlpha + colour.2 * behind) / alpha
    }
    return out
  }

  // -------------------------------------------------------------------------
  // Exact Euclidean distance transform (Felzenszwalb & Huttenlocher).
  //
  // Two passes of a 1D lower-envelope transform — columns, then rows — give
  // exact squared Euclidean distances in O(n). The approximate chamfer metrics
  // usually reached for here are precisely what produce a stroke whose width
  // depends on direction, which is the defect being fixed.
  // -------------------------------------------------------------------------
  private static func euclideanDistanceTransform(_ source: [Float], width: Int, height: Int) -> [Float] {
    var data = source

    var column = [Float](repeating: 0, count: height)
    for x in 0..<width {
      for y in 0..<height { column[y] = data[y * width + x] }
      let transformed = distanceTransform1D(column)
      for y in 0..<height { data[y * width + x] = transformed[y] }
    }

    var row = [Float](repeating: 0, count: width)
    for y in 0..<height {
      let offset = y * width
      for x in 0..<width { row[x] = data[offset + x] }
      let transformed = distanceTransform1D(row)
      for x in 0..<width { data[offset + x] = transformed[x] }
    }

    return data
  }

  private static func distanceTransform1D(_ f: [Float]) -> [Float] {
    let n = f.count
    guard n > 0 else { return f }

    var d = [Float](repeating: 0, count: n)
    var v = [Int](repeating: 0, count: n)
    var z = [Float](repeating: 0, count: n + 1)
    var k = 0

    v[0] = 0
    z[0] = -1e20
    z[1] = 1e20

    if n > 1 {
      for q in 1..<n {
        var s = intersection(f, q, v[k])
        // `k > 0` is belt-and-braces. With the sentinels used here the
        // envelope cannot walk off the front (z[0] is -1e20 while the most
        // negative intersection is about -5e19), but a NaN slipping in from a
        // malformed matte would otherwise index out of bounds and crash the
        // app rather than produce one wrong pixel.
        while k > 0 && s <= z[k] {
          k -= 1
          s = intersection(f, q, v[k])
        }
        k += 1
        v[k] = q
        z[k] = s
        z[k + 1] = 1e20
      }
    }

    k = 0
    for q in 0..<n {
      while z[k + 1] < Float(q) { k += 1 }
      let delta = Float(q - v[k])
      d[q] = delta * delta + f[v[k]]
    }
    return d
  }

  private static func intersection(_ f: [Float], _ q: Int, _ vk: Int) -> Float {
    let numerator = (f[q] + Float(q * q)) - (f[vk] + Float(vk * vk))
    let denominator = Float(2 * q - 2 * vk)
    return numerator / denominator
  }

  // -------------------------------------------------------------------------
  // Border colour — ported from the server's pickBorderColor so the change of
  // engine doesn't also change the palette.
  //
  // White by default. Only deviates when the subject has a clear, saturated
  // hue, in which case a soft pastel of the complementary hue reads as
  // deliberate rather than clashing. Washed-out, very light and very dark
  // subjects keep white, since a tint would go muddy against them.
  // -------------------------------------------------------------------------
  private static func pickBorderColour(_ image: PlanarImage) -> (Float, Float, Float) {
    let white: (Float, Float, Float) = (1, 1, 1)

    var sumSin = 0.0, sumCos = 0.0, sumSaturation = 0.0, sumLightness = 0.0
    var count = 0
    for i in 0..<image.count where image.a[i] > 0.25 {
      let (hue, saturation, lightness) = rgbToHsl(image.r[i], image.g[i], image.b[i])
      let radians = hue * Double.pi / 180
      // Weight hue by saturation so vivid pixels dominate the circular mean.
      sumSin += sin(radians) * saturation
      sumCos += cos(radians) * saturation
      sumSaturation += saturation
      sumLightness += lightness
      count += 1
    }
    guard count > 0 else { return white }

    let averageSaturation = sumSaturation / Double(count)
    let averageLightness = sumLightness / Double(count)
    if averageSaturation < 0.18 || averageLightness > 0.85 || averageLightness < 0.15 {
      return white
    }

    var hue = atan2(sumSin, sumCos) * 180 / Double.pi
    if hue < 0 { hue += 360 }
    let complement = (hue + 180).truncatingRemainder(dividingBy: 360)
    return hslToRgb(complement, 0.45, 0.82)
  }

  private static func rgbToHsl(_ r: Float, _ g: Float, _ b: Float) -> (Double, Double, Double) {
    let rd = Double(r), gd = Double(g), bd = Double(b)
    let maximum = max(rd, gd, bd), minimum = min(rd, gd, bd)
    let lightness = (maximum + minimum) / 2
    let delta = maximum - minimum
    guard delta != 0 else { return (0, 0, lightness) }

    let saturation = delta / (1 - abs(2 * lightness - 1))
    var hue: Double
    if maximum == rd {
      hue = ((gd - bd) / delta).truncatingRemainder(dividingBy: 6)
    } else if maximum == gd {
      hue = (bd - rd) / delta + 2
    } else {
      hue = (rd - gd) / delta + 4
    }
    hue *= 60
    if hue < 0 { hue += 360 }
    return (hue, saturation, lightness)
  }

  private static func hslToRgb(_ h: Double, _ s: Double, _ l: Double) -> (Float, Float, Float) {
    let c = (1 - abs(2 * l - 1)) * s
    let x = c * (1 - abs((h / 60).truncatingRemainder(dividingBy: 2) - 1))
    let m = l - c / 2
    var r = 0.0, g = 0.0, b = 0.0
    switch h {
    case ..<60: (r, g, b) = (c, x, 0)
    case ..<120: (r, g, b) = (x, c, 0)
    case ..<180: (r, g, b) = (0, c, x)
    case ..<240: (r, g, b) = (0, x, c)
    case ..<300: (r, g, b) = (x, 0, c)
    default: (r, g, b) = (c, 0, x)
    }
    return (Float(r + m), Float(g + m), Float(b + m))
  }

  // -------------------------------------------------------------------------
  // Area-average downsample.
  //
  // Done in premultiplied space: averaging straight RGB across the boundary
  // would let fully transparent pixels drag their colour into visible ones,
  // which is the same halo the decontamination pass just removed.
  // -------------------------------------------------------------------------
  private static func downsample(_ image: PlanarImage, maxDimension: Int) -> PlanarImage {
    let longSide = max(image.width, image.height)
    guard longSide > maxDimension, maxDimension > 0 else { return image }

    let scale = Double(maxDimension) / Double(longSide)
    let width = max(1, Int((Double(image.width) * scale).rounded()))
    let height = max(1, Int((Double(image.height) * scale).rounded()))

    var out = PlanarImage(width: width, height: height)
    let xRatio = Double(image.width) / Double(width)
    let yRatio = Double(image.height) / Double(height)

    for y in 0..<height {
      let sourceY0 = Int(Double(y) * yRatio)
      let sourceY1 = max(sourceY0 + 1, min(image.height, Int((Double(y) + 1) * yRatio)))
      for x in 0..<width {
        let sourceX0 = Int(Double(x) * xRatio)
        let sourceX1 = max(sourceX0 + 1, min(image.width, Int((Double(x) + 1) * xRatio)))

        var sumR: Float = 0, sumG: Float = 0, sumB: Float = 0, sumA: Float = 0
        var samples: Float = 0
        for sy in sourceY0..<sourceY1 {
          let offset = sy * image.width
          for sx in sourceX0..<sourceX1 {
            let i = offset + sx
            let a = image.a[i]
            sumR += image.r[i] * a
            sumG += image.g[i] * a
            sumB += image.b[i] * a
            sumA += a
            samples += 1
          }
        }
        guard samples > 0 else { continue }

        let destination = y * width + x
        let alpha = sumA / samples
        out.a[destination] = alpha
        if sumA > 1e-5 {
          out.r[destination] = min(1, max(0, sumR / sumA))
          out.g[destination] = min(1, max(0, sumG / sumA))
          out.b[destination] = min(1, max(0, sumB / sumA))
        }
      }
    }
    return out
  }
}
