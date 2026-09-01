import CoreGraphics
import CoreVideo
import Foundation
import Vision

// ---------------------------------------------------------------------------
// Vision instance segmentation, disambiguated by the user's own selection.
//
// This is the load-bearing idea of the whole pipeline. Vision does not return
// "the foreground" — it returns a *set of instances*, and lets you ask for any
// subset of them. So the user's box or lasso stops being a correction applied
// to a model's answer (which is what the server's forceIncludeLasso had to be,
// against a salient-object model that could not be told anything) and becomes
// the thing that picks which answer we take.
//
// Two scores drive the choice, and they catch opposite mistakes:
//
//   containment = (instance ∩ selection) / instance
//       "is this instance mostly inside what the user circled?"
//       Low when Vision grabbed the whole table and the selection sits on it.
//
//   coverage    = (instance ∩ selection) / selection
//       "does this instance fill enough of what the user circled?"
//       Low when Vision grabbed a specular highlight or a logo on the object.
//
// Both thresholds are supplied by the caller rather than hardcoded here, so
// they can be tuned from JavaScript against real scans without spending an
// EAS build.
// ---------------------------------------------------------------------------
@available(iOS 17.0, *)
enum SubjectSegmenter {

  struct Result {
    /// Soft alpha, 0...1, at the source image's resolution.
    let alpha: [Float]
    let width: Int
    let height: Int
    let instanceCount: Int
    let selectedCount: Int
    let containment: Double
    let coverage: Double
  }

  /// Above this share of the frame, a selection is treated as expressing no
  /// preference about *which* object — only that there is one.
  private static let unspecificSelectionRatio = 0.9

  static func segment(
    image: CGImage,
    polygon: [CutoutPoint],
    minContainment: Double,
    minCoverage: Double
  ) throws -> Result {
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()

    do {
      try handler.perform([request])
    } catch {
      throw CutoutError(.visionFailed, error.localizedDescription)
    }

    guard let observation = request.results?.first as? VNInstanceMaskObservation else {
      throw CutoutError(.noInstances, "no instance mask observation")
    }

    let allInstances = observation.allInstances
    guard !allInstances.isEmpty else {
      throw CutoutError(.noInstances, "vision found no foreground objects")
    }

    // Score against the low-resolution label map rather than generating a
    // full-resolution mask per instance: the label map is one small buffer
    // covering every instance at once, where per-instance scaled masks would
    // each be a full float image (16MB at 2048²) just to be thrown away.
    let scores = try score(
      instanceMask: observation.instanceMask,
      polygon: polygon,
      imageWidth: image.width,
      imageHeight: image.height,
      instances: allInstances
    )

    guard scores.polygonPixels > 0 else {
      throw CutoutError(.noMatchingInstance, "selection projected to zero pixels")
    }
    let maskArea = scores.maskArea

    // A selection covering essentially the whole frame expresses no preference
    // — every instance is trivially "inside" it, so containment carries no
    // information and unioning everything that passes would cut out the mug,
    // the notebook and the plant together. The box tool now starts at the full
    // frame, so this is the common case, not an edge one.
    //
    // Treated as "just pick the subject": the instance with the most pixels.
    // Vision already returns a multi-part object as one instance most of the
    // time, so the union this gives up was mostly defensive anyway — and when
    // the user does want several things, narrowing the box or tracing a loop
    // says so explicitly.
    let unspecific = Double(scores.polygonPixels) >= Double(maskArea) * unspecificSelectionRatio

    var selected = IndexSet()
    var selectedInside = 0
    var selectedTotal = 0

    if unspecific {
      if let dominant = scores.perInstance.max(by: { $0.value.inside < $1.value.inside }) {
        selected.insert(dominant.key)
        selectedInside = dominant.value.inside
        selectedTotal = dominant.value.total
      }
    } else {
      for (index, tally) in scores.perInstance {
        let containment = tally.total > 0 ? Double(tally.inside) / Double(tally.total) : 0
        if containment >= minContainment {
          selected.insert(index)
          selectedInside += tally.inside
          selectedTotal += tally.total
        }
      }
    }

    // Best single-instance figures, reported whether or not we accept — these
    // are the numbers that tell us in production whether the thresholds are
    // set sensibly.
    let bestContainment = scores.perInstance.values
      .map { $0.total > 0 ? Double($0.inside) / Double($0.total) : 0 }
      .max() ?? 0
    let bestCoverage = scores.perInstance.values
      .map { Double($0.inside) / Double(scores.polygonPixels) }
      .max() ?? 0

    let coverage = selected.isEmpty ? 0 : Double(selectedInside) / Double(scores.polygonPixels)
    let containment = selectedTotal > 0 ? Double(selectedInside) / Double(selectedTotal) : 0

    if selected.isEmpty || (!unspecific && coverage < minCoverage) {
      var err = CutoutError(
        .noMatchingInstance,
        selected.isEmpty
          ? "no instance sits inside the selection"
          : "selected instances fill only \(Int(coverage * 100))% of the selection"
      )
      err.instanceCount = allInstances.count
      err.bestContainment = bestContainment
      err.bestCoverage = bestCoverage
      throw err
    }

    // Only now, for the winners only, pay for a full-resolution soft mask.
    let maskBuffer: CVPixelBuffer
    do {
      maskBuffer = try observation.generateScaledMaskForImage(forInstances: selected, from: handler)
    } catch {
      throw CutoutError(.visionFailed, "scaled mask: \(error.localizedDescription)")
    }

    let alpha = try floatPlane(from: maskBuffer, width: image.width, height: image.height)

    return Result(
      alpha: alpha,
      width: image.width,
      height: image.height,
      instanceCount: allInstances.count,
      selectedCount: selected.count,
      containment: containment,
      coverage: coverage
    )
  }

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------
  private struct Tally {
    var inside = 0
    var total = 0
  }

  private struct Scores {
    var perInstance: [Int: Tally]
    var polygonPixels: Int
    /// Total pixels in the label map, for judging how much of the frame the
    /// selection actually covers.
    var maskArea: Int
  }

  private static func score(
    instanceMask: CVPixelBuffer,
    polygon: [CutoutPoint],
    imageWidth: Int,
    imageHeight: Int,
    instances: IndexSet
  ) throws -> Scores {
    CVPixelBufferLockBaseAddress(instanceMask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(instanceMask, .readOnly) }

    let maskWidth = CVPixelBufferGetWidth(instanceMask)
    let maskHeight = CVPixelBufferGetHeight(instanceMask)
    let rowBytes = CVPixelBufferGetBytesPerRow(instanceMask)
    guard let base = CVPixelBufferGetBaseAddress(instanceMask) else {
      throw CutoutError(.visionFailed, "instance mask has no base address")
    }
    guard maskWidth > 0, maskHeight > 0, imageWidth > 0, imageHeight > 0 else {
      throw CutoutError(.visionFailed, "degenerate instance mask dimensions")
    }

    // The label map is documented as one byte per pixel holding the instance
    // index, with 0 for background — but that's an assumption about a buffer
    // Vision hands us, and reading it at the wrong stride would produce
    // plausible-looking nonsense scores rather than an obvious failure. Check
    // it, and if the format ever changes under us, fall back to the server
    // and say so in telemetry instead of quietly cutting out the wrong thing.
    let format = CVPixelBufferGetPixelFormatType(instanceMask)
    guard format == kCVPixelFormatType_OneComponent8 else {
      throw CutoutError(.visionFailed, "unexpected instance mask format \(format)")
    }

    // The label map covers the same framing as the source image, just at the
    // model's working resolution. Scaling each axis independently keeps this
    // correct even if Vision's mask isn't exactly the source aspect ratio.
    let scaleX = Double(maskWidth) / Double(imageWidth)
    let scaleY = Double(maskHeight) / Double(imageHeight)
    let projected = polygon.map { CutoutPoint(x: $0.x * scaleX, y: $0.y * scaleY) }

    var minX = Double.greatestFiniteMagnitude
    var maxX = -Double.greatestFiniteMagnitude
    var minY = Double.greatestFiniteMagnitude
    var maxY = -Double.greatestFiniteMagnitude
    for p in projected {
      minX = min(minX, p.x); maxX = max(maxX, p.x)
      minY = min(minY, p.y); maxY = max(maxY, p.y)
    }
    let x0 = max(0, Int(minX.rounded(.down)))
    let x1 = min(maskWidth - 1, Int(maxX.rounded(.up)))
    let y0 = max(0, Int(minY.rounded(.down)))
    let y1 = min(maskHeight - 1, Int(maxY.rounded(.up)))

    var perInstance: [Int: Tally] = [:]
    for i in instances { perInstance[i] = Tally() }

    let bytes = base.assumingMemoryBound(to: UInt8.self)

    // Total area per instance, over the whole frame — an instance that
    // extends far outside the selection must be counted in full, or its
    // containment score would always look perfect.
    for y in 0..<maskHeight {
      let row = bytes.advanced(by: y * rowBytes)
      for x in 0..<maskWidth {
        let label = Int(row[x])
        if label != 0, perInstance[label] != nil {
          perInstance[label]!.total += 1
        }
      }
    }

    var polygonPixels = 0
    if x1 >= x0 && y1 >= y0 {
      for y in y0...y1 {
        let row = bytes.advanced(by: y * rowBytes)
        for x in x0...x1 {
          guard pointInPolygon(x: Double(x) + 0.5, y: Double(y) + 0.5, polygon: projected) else {
            continue
          }
          polygonPixels += 1
          let label = Int(row[x])
          if label != 0, perInstance[label] != nil {
            perInstance[label]!.inside += 1
          }
        }
      }
    }

    return Scores(
      perInstance: perInstance,
      polygonPixels: polygonPixels,
      maskArea: maskWidth * maskHeight
    )
  }

  /// Even-odd ray casting, matching the server's existing pointInPolygon so
  /// both paths agree on what "inside the loop" means.
  private static func pointInPolygon(x: Double, y: Double, polygon: [CutoutPoint]) -> Bool {
    var inside = false
    var j = polygon.count - 1
    for i in 0..<polygon.count {
      let xi = polygon[i].x, yi = polygon[i].y
      let xj = polygon[j].x, yj = polygon[j].y
      if (yi > y) != (yj > y) {
        let denominator = yj - yi
        if denominator != 0, x < (xj - xi) * (y - yi) / denominator + xi {
          inside.toggle()
        }
      }
      j = i
    }
    return inside
  }

  // -------------------------------------------------------------------------
  // CVPixelBuffer (OneComponent32Float) -> [Float]
  //
  // Vision's scaled mask comes back at the source image's dimensions, but its
  // row stride is its own business — read row by row rather than assuming a
  // packed buffer.
  // -------------------------------------------------------------------------
  private static func floatPlane(from buffer: CVPixelBuffer, width: Int, height: Int) throws -> [Float] {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }

    let bufferWidth = CVPixelBufferGetWidth(buffer)
    let bufferHeight = CVPixelBufferGetHeight(buffer)
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    guard let base = CVPixelBufferGetBaseAddress(buffer) else {
      throw CutoutError(.visionFailed, "scaled mask has no base address")
    }

    var out = [Float](repeating: 0, count: width * height)
    let copyWidth = min(width, bufferWidth)
    let copyHeight = min(height, bufferHeight)

    for y in 0..<copyHeight {
      let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float.self)
      let destinationStart = y * width
      for x in 0..<copyWidth {
        out[destinationStart + x] = min(1, max(0, row[x]))
      }
    }
    return out
  }
}
