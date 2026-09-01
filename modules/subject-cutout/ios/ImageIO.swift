import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// ---------------------------------------------------------------------------
// Loading and saving
//
// Loading goes through CGImageSource's thumbnail path rather than
// UIImage(contentsOfFile:) for two reasons: it downsamples during decode
// (so a 12MP capture never fully materialises in memory), and
// kCGImageSourceCreateThumbnailWithTransform bakes EXIF orientation into the
// pixels. Vision works in the image's own pixel space, so an un-baked
// orientation would silently rotate every mask relative to the lasso.
// ---------------------------------------------------------------------------
enum ImageIO {

  static func loadCGImage(uri: String, maxDimension: Int) throws -> CGImage {
    guard let url = normalisedURL(uri) else {
      throw CutoutError(.loadFailed, "could not parse uri")
    }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
      throw CutoutError(.loadFailed, "could not open image source")
    }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: maxDimension,
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
      throw CutoutError(.loadFailed, "could not decode image")
    }
    return image
  }

  /// `file://` URIs arrive from expo-image-manipulator; bare paths arrive from
  /// some library-import edge cases. Accept both.
  private static func normalisedURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") || uri.hasPrefix("/") {
      return URL(string: uri) ?? URL(fileURLWithPath: uri)
    }
    return URL(string: uri)
  }

  // -------------------------------------------------------------------------
  // CGImage -> planar float RGB (alpha left at zero; Vision fills it later)
  // -------------------------------------------------------------------------
  static func planarRGB(from image: CGImage) throws -> PlanarImage {
    let width = image.width
    let height = image.height
    let count = width * height

    var interleaved = [UInt8](repeating: 0, count: count * 4)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
      throw CutoutError(.loadFailed, "no sRGB colour space")
    }
    // noneSkipLast: the source photo has no alpha, and asking for a
    // premultiplied format here would mean un-premultiplying later for no
    // reason.
    let bitmapInfo = CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    guard let context = interleaved.withUnsafeMutableBytes({ raw -> CGContext? in
      CGContext(
        data: raw.baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo
      )
    }) else {
      throw CutoutError(.loadFailed, "could not create bitmap context")
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    var out = PlanarImage(width: width, height: height)
    let inv: Float = 1.0 / 255.0
    for i in 0..<count {
      let o = i * 4
      out.r[i] = Float(interleaved[o]) * inv
      out.g[i] = Float(interleaved[o + 1]) * inv
      out.b[i] = Float(interleaved[o + 2]) * inv
    }
    return out
  }

  // -------------------------------------------------------------------------
  // Planar float RGBA -> PNG on disk
  //
  // Written straight-alpha (not premultiplied): the app renders these through
  // expo-image, and CutoutSticker's `tintColor` outline trick reads the alpha
  // channel directly, which premultiplied data would distort.
  // -------------------------------------------------------------------------
  static func writePNG(_ image: PlanarImage, to url: URL) throws {
    let width = image.width
    let height = image.height
    let count = width * height

    var interleaved = [UInt8](repeating: 0, count: count * 4)
    for i in 0..<count {
      let o = i * 4
      interleaved[o] = quantise(image.r[i])
      interleaved[o + 1] = quantise(image.g[i])
      interleaved[o + 2] = quantise(image.b[i])
      interleaved[o + 3] = quantise(image.a[i])
    }

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
      throw CutoutError(.encodeFailed, "no sRGB colour space")
    }
    let bitmapInfo = CGImageAlphaInfo.last.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    guard let provider = CGDataProvider(data: Data(interleaved) as CFData),
          let cgImage = CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: bitmapInfo),
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
          )
    else {
      throw CutoutError(.encodeFailed, "could not build CGImage")
    }

    guard let destination = CGImageDestinationCreateWithURL(
      url as CFURL, UTType.png.identifier as CFString, 1, nil
    ) else {
      throw CutoutError(.encodeFailed, "could not create PNG destination")
    }
    CGImageDestinationAddImage(destination, cgImage, nil)
    guard CGImageDestinationFinalize(destination) else {
      throw CutoutError(.encodeFailed, "PNG finalize failed")
    }
  }

  private static func quantise(_ v: Float) -> UInt8 {
    UInt8(max(0, min(255, (v * 255).rounded())))
  }
}
