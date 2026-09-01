import Foundation

// ---------------------------------------------------------------------------
// Turning a hand-drawn loop into a matte.
//
// When Vision returns nothing, the pipeline still has a strong signal that the
// old server path throws away: the user drew around the object. That loop is
// the highest-confidence input available — it just isn't accurate. People
// trace generously, and a loop is routinely tens of pixels off the true
// boundary, so using it directly as an alpha channel produces a cutout with a
// visible hand-drawn edge.
//
// The fix is to treat the loop as a *region of confidence* rather than a
// boundary. Well inside it is definitely subject; well outside is definitely
// background; the ring between the two is unknown, and alpha there is solved
// from the colours actually present on either side. That is the classical
// trimap formulation, with one adaptation that matters on a phone: the
// foreground and background colour models are local rather than global,
// because a real scene's background is not one colour. Both are recovered with
// the same weighted box blur the decontamination pass already uses, so the
// sampling radius — and with it the amount of drawing error that can be
// corrected — is just a blur radius.
// ---------------------------------------------------------------------------
enum LassoMatter {

  /// Half-width of the uncertain ring, as a fraction of the loop's own size.
  /// This is the drawing error the matte can absorb: too small and a sloppy
  /// loop keeps its hand-drawn edge, too large and genuine detail is dissolved
  /// into the band. 3% of the subject is roughly a fingertip's worth of slop.
  private static let bandRatio: Double = 0.03
  private static let minBand = 6
  private static let maxBand = 64

  /// How far out to sample colours, relative to the band. Wider than the band
  /// on purpose: a pixel in the middle of the ring needs to see confident
  /// pixels on *both* sides of it.
  private static let sampleRadiusMultiplier = 2

  static func matte(image: PlanarImage, polygon: [CutoutPoint]) -> [Float] {
    let width = image.width
    let height = image.height
    let count = width * height

    var inside = [Float](repeating: 0, count: count)
    fillPolygon(polygon, into: &inside, width: width, height: height)

    let band = bandWidth(polygon: polygon, width: width, height: height)
    // A box blur of the filled region doubles as a cheap morphological pair:
    // the blurred value is the share of the window that lies inside, so a high
    // value is an erosion and a low value is the complement of a dilation.
    let occupancy = MatteRefiner.boxBlur(inside, width: width, height: height, radius: band)

    var foregroundMask = [Float](repeating: 0, count: count)
    var backgroundMask = [Float](repeating: 0, count: count)
    for i in 0..<count {
      if occupancy[i] >= 0.9 {
        foregroundMask[i] = 1
      } else if occupancy[i] <= 0.1 {
        backgroundMask[i] = 1
      }
    }

    let sampleRadius = max(band * sampleRadiusMultiplier, band + 2)
    let foreground = localColour(image, weight: foregroundMask, radius: sampleRadius)
    let background = localColour(image, weight: backgroundMask, radius: sampleRadius)

    var alpha = [Float](repeating: 0, count: count)
    for i in 0..<count {
      if foregroundMask[i] == 1 {
        alpha[i] = 1
        continue
      }
      if backgroundMask[i] == 1 {
        alpha[i] = 0
        continue
      }

      // Project this pixel's colour onto the line between the local background
      // and foreground estimates. Where they're distinguishable this is a real
      // opacity; where they aren't, the projection is meaningless and the
      // loop's own occupancy is the better answer.
      let fr = foreground.r[i] - background.r[i]
      let fg = foreground.g[i] - background.g[i]
      let fb = foreground.b[i] - background.b[i]
      let separation = fr * fr + fg * fg + fb * fb

      guard separation > 1e-3 else {
        alpha[i] = occupancy[i]
        continue
      }

      let cr = image.r[i] - background.r[i]
      let cg = image.g[i] - background.g[i]
      let cb = image.b[i] - background.b[i]
      let projection = (cr * fr + cg * fg + cb * fb) / separation

      // Blend toward the loop's own shape where colour is only weakly
      // separated, so a low-contrast stretch of the boundary degrades to
      // "follow what was drawn" instead of to noise.
      let trust = min(1, separation * 12)
      alpha[i] = min(1, max(0, projection)) * trust + occupancy[i] * (1 - trust)
    }

    return alpha
  }

  // -------------------------------------------------------------------------
  private static func bandWidth(polygon: [CutoutPoint], width: Int, height: Int) -> Int {
    var minX = Double.greatestFiniteMagnitude, maxX = -Double.greatestFiniteMagnitude
    var minY = Double.greatestFiniteMagnitude, maxY = -Double.greatestFiniteMagnitude
    for p in polygon {
      minX = min(minX, p.x); maxX = max(maxX, p.x)
      minY = min(minY, p.y); maxY = max(maxY, p.y)
    }
    let span = max(maxX - minX, maxY - minY)
    let scaled = Int((span * bandRatio).rounded())
    return max(minBand, min(maxBand, scaled))
  }

  /// Colour of the confident pixels near each location — `blur(I·w) / blur(w)`.
  /// Where no confident pixel is in range the denominator collapses, and the
  /// caller falls back to the loop's own shape.
  private static func localColour(
    _ image: PlanarImage, weight: [Float], radius: Int
  ) -> (r: [Float], g: [Float], b: [Float]) {
    let width = image.width
    let height = image.height
    let count = width * height
    let denominator = MatteRefiner.boxBlur(weight, width: width, height: height, radius: radius)

    func channel(_ source: [Float]) -> [Float] {
      var weighted = [Float](repeating: 0, count: count)
      for i in 0..<count { weighted[i] = source[i] * weight[i] }
      let numerator = MatteRefiner.boxBlur(weighted, width: width, height: height, radius: radius)
      var out = [Float](repeating: 0, count: count)
      for i in 0..<count {
        out[i] = denominator[i] > 1e-4 ? numerator[i] / denominator[i] : source[i]
      }
      return out
    }

    return (channel(image.r), channel(image.g), channel(image.b))
  }

  // -------------------------------------------------------------------------
  // Scanline polygon fill.
  //
  // Testing every pixel against every edge would be O(pixels × vertices) — a
  // hand-drawn loop carries hundreds of vertices, and at two megapixels that is
  // hundreds of millions of tests. Walking one row at a time and filling
  // between sorted crossings is O(rows × vertices + area).
  // -------------------------------------------------------------------------
  private static func fillPolygon(
    _ polygon: [CutoutPoint], into buffer: inout [Float], width: Int, height: Int
  ) {
    guard polygon.count >= 3 else { return }
    var crossings = [Double]()
    crossings.reserveCapacity(polygon.count)

    for y in 0..<height {
      let scanY = Double(y) + 0.5
      crossings.removeAll(keepingCapacity: true)

      var j = polygon.count - 1
      for i in 0..<polygon.count {
        let a = polygon[i]
        let b = polygon[j]
        if (a.y > scanY) != (b.y > scanY) {
          let span = b.y - a.y
          if span != 0 {
            crossings.append(a.x + (scanY - a.y) * (b.x - a.x) / span)
          }
        }
        j = i
      }
      guard crossings.count >= 2 else { continue }
      crossings.sort()

      var k = 0
      while k + 1 < crossings.count {
        let start = max(0, Int(crossings[k].rounded()))
        let end = min(width - 1, Int(crossings[k + 1].rounded()) - 1)
        if start <= end {
          let row = y * width
          for x in start...end { buffer[row + x] = 1 }
        }
        k += 2
      }
    }
  }
}
