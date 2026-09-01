import ExpoModulesCore
import Foundation

// ---------------------------------------------------------------------------
// The JS surface.
//
// Deliberately thin: every threshold that decides whether a cutout is good
// enough to keep arrives from JavaScript rather than being compiled in. The
// gate is the part most likely to need tuning against real scans, and tuning a
// constant in TypeScript costs a hot reload where tuning one in Swift costs an
// EAS build.
// ---------------------------------------------------------------------------

struct PointRecord: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
}

struct CutoutOptions: Record {
  /// Local file URI of the cropped source photo.
  @Field var uri: String = ""
  /// The user's selection — a traced lasso, or the four corners of the box —
  /// in the pixel space named by `sourceWidth`/`sourceHeight`.
  @Field var polygon: [PointRecord] = []
  /// The pixel dimensions the polygon was measured against. The decode below
  /// may downsample, so the polygon has to be rescaled to match; passing the
  /// dimensions explicitly means the caller never has to predict what size we
  /// chose. Zero means "already in the decoded image's space".
  @Field var sourceWidth: Int = 0
  @Field var sourceHeight: Int = 0
  /// Longest side the photo is decoded at. Segmentation quality scales with
  /// this; the server path is effectively pinned at 320px by comparison.
  @Field var maxDimension: Int = 1600
  /// Longest side of the delivered PNG. Lower than `maxDimension` on purpose:
  /// the mask benefits from the extra pixels, the shipped file does not.
  @Field var outputMaxDimension: Int = 1280
  /// Minimum share of an instance that must fall inside the selection.
  @Field var minContainment: Double = 0.55
  /// Minimum share of the selection the kept instances must fill.
  @Field var minCoverage: Double = 0.12
  /// Reject a matte that keeps less than this share of its own canvas.
  @Field var minSubjectAreaRatio: Double = 0.01
  /// Reject a matte that keeps more than this share — nothing was separated.
  @Field var maxSubjectAreaRatio: Double = 0.98
  /// Skip Vision entirely and build the matte from the selection itself.
  ///
  /// For when Vision found nothing but the user traced a loop: the loop is
  /// still a strong signal, just an imprecise one, and solving alpha in a band
  /// around it beats handing the photo to a server that knows even less about
  /// where the object is. See LassoMatter.
  @Field var selectionAsMask: Bool = false
}

public class SubjectCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectCutout")

    Function("isAvailable") { () -> Bool in
      #if targetEnvironment(simulator)
        // Vision's segmentation models aren't present on the Simulator; the
        // request returns no instances rather than failing loudly, which would
        // otherwise look like "every photo is a hard case".
        return false
      #else
        if #available(iOS 17.0, *) { return true }
        return false
      #endif
    }

    // Everything this calls is a free function rather than a method, because
    // ModuleDefinition's closures are @escaping — a method call here would
    // capture `self` and need spelling out at every use.
    AsyncFunction("cutout") { (options: CutoutOptions) -> [String: Any] in
      #if targetEnvironment(simulator)
        return cutoutFailure(.simulator, "Vision segmentation is unavailable on the Simulator")
      #else
        guard #available(iOS 17.0, *) else {
          return cutoutFailure(.unsupportedOS, "requires iOS 17 or later")
        }
        return performCutout(options)
      #endif
    }
    .runOnQueue(DispatchQueue.global(qos: .userInitiated))
  }
}

// ---------------------------------------------------------------------------
@available(iOS 17.0, *)
private func performCutout(_ options: CutoutOptions) -> [String: Any] {
  let started = Date()
  do {
    guard options.polygon.count >= 3 else {
      throw CutoutError(.noMatchingInstance, "selection needs at least 3 points")
    }

    // Per-stage timings, so a slow run can be diagnosed from one scan instead
    // of from another build.
    var mark = Date()
    func lap() -> Int {
      let elapsed = Int(Date().timeIntervalSince(mark) * 1000)
      mark = Date()
      return elapsed
    }

    let cgImage = try ImageIO.loadCGImage(uri: options.uri, maxDimension: options.maxDimension)
    var working = try ImageIO.planarRGB(from: cgImage)
    let decodeMs = lap()

    // The polygon arrives in the source file's pixel space, but the decode
    // above may have downsampled. Rescale rather than making the caller
    // predict what size we chose.
    let polygon = rescale(
      options.polygon,
      fromWidth: options.sourceWidth > 0 ? options.sourceWidth : cgImage.width,
      toWidth: cgImage.width,
      fromHeight: options.sourceHeight > 0 ? options.sourceHeight : cgImage.height,
      toHeight: cgImage.height
    )

    let instanceCount: Int
    let selectedCount: Int
    let containment: Double
    let coverage: Double

    if options.selectionAsMask {
      working.a = LassoMatter.matte(image: working, polygon: polygon)
      instanceCount = 0
      selectedCount = 0
      // The selection is, by construction, entirely within itself.
      containment = 1
      coverage = 1
    } else {
      let segmentation = try SubjectSegmenter.segment(
        image: cgImage,
        polygon: polygon,
        minContainment: options.minContainment,
        minCoverage: options.minCoverage
      )
      working.a = segmentation.alpha
      instanceCount = segmentation.instanceCount
      selectedCount = segmentation.selectedCount
      containment = segmentation.containment
      coverage = segmentation.coverage
    }

    let visionMs = lap()

    let subjectArea = working.a.reduce(Float(0), +) / Float(max(1, working.count))
    if Double(subjectArea) < options.minSubjectAreaRatio {
      throw CutoutError(.degenerateMask, "matte keeps only \(Int(subjectArea * 100))% of the frame")
    }
    if Double(subjectArea) > options.maxSubjectAreaRatio {
      throw CutoutError(.degenerateMask, "matte keeps \(Int(subjectArea * 100))% of the frame — nothing separated")
    }

    MatteRefiner.refine(&working)
    let refineMs = lap()

    let styled = StickerStyler.style(working, outputMaxDimension: options.outputMaxDimension)
    let styleMs = lap()

    let destination = FileManager.default.temporaryDirectory
      .appendingPathComponent("cutout-\(UUID().uuidString).png")
    try ImageIO.writePNG(styled, to: destination)
    let encodeMs = lap()

    return [
      "ok": true,
      "uri": destination.absoluteString,
      "width": styled.width,
      "height": styled.height,
      "instanceCount": instanceCount,
      "selectedCount": selectedCount,
      "containment": containment,
      "coverage": coverage,
      "subjectAreaRatio": Double(subjectArea),
      "durationMs": Int(Date().timeIntervalSince(started) * 1000),
      "decodeMs": decodeMs,
      "visionMs": visionMs,
      "refineMs": refineMs,
      "styleMs": styleMs,
      "encodeMs": encodeMs,
      "workingWidth": cgImage.width,
      "workingHeight": cgImage.height,
    ]
  } catch let error as CutoutError {
    var payload = cutoutFailure(error.failure, error.detail)
    payload["instanceCount"] = error.instanceCount
    payload["containment"] = error.bestContainment
    payload["coverage"] = error.bestCoverage
    payload["durationMs"] = Int(Date().timeIntervalSince(started) * 1000)
    return payload
  } catch {
    var payload = cutoutFailure(.visionFailed, error.localizedDescription)
    payload["durationMs"] = Int(Date().timeIntervalSince(started) * 1000)
    return payload
  }
}

private func cutoutFailure(_ reason: CutoutFailure, _ detail: String?) -> [String: Any] {
  var payload: [String: Any] = ["ok": false, "reason": reason.rawValue]
  if let detail { payload["detail"] = detail }
  return payload
}

private func rescale(
  _ points: [PointRecord],
  fromWidth: Int,
  toWidth: Int,
  fromHeight: Int,
  toHeight: Int
) -> [CutoutPoint] {
  guard fromWidth > 0, fromHeight > 0 else {
    return points.map { CutoutPoint(x: $0.x, y: $0.y) }
  }
  let scaleX = Double(toWidth) / Double(fromWidth)
  let scaleY = Double(toHeight) / Double(fromHeight)
  return points.map { CutoutPoint(x: $0.x * scaleX, y: $0.y * scaleY) }
}
