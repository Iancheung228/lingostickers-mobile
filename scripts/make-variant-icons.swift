// Draws the dev and preview app icons from assets/icon.png: the same icon with
// a coloured band and a label along the bottom, so Tabi Dev / Tabi Preview are
// never mistaken for the store app on a home screen. Re-run after changing the icon:
//   swift scripts/make-variant-icons.swift
import AppKit

let src = NSImage(contentsOfFile: "assets/icon.png")!
let rep = src.representations.first!
let size = CGSize(width: rep.pixelsWide, height: rep.pixelsHigh)

func make(_ label: String, _ color: NSColor, _ out: String) {
  let ctx = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8,
                      bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!  // no alpha: iOS icons must be opaque
  var rect = CGRect(origin: .zero, size: size)
  ctx.draw(src.cgImage(forProposedRect: &rect, context: nil, hints: nil)!, in: rect)
  let band = CGRect(x: 0, y: 0, width: size.width, height: size.height * 0.24)
  ctx.setFillColor(color.cgColor)
  ctx.fill(band)
  NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
  let style = NSMutableParagraphStyle(); style.alignment = .center
  let font = NSFont.systemFont(ofSize: size.height * 0.15, weight: .heavy)
  let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white, .paragraphStyle: style, .kern: size.width * 0.02]
  let h = font.ascender - font.descender
  (label as NSString).draw(in: CGRect(x: 0, y: (band.height - h) / 2, width: size.width, height: h), withAttributes: attrs)
  let png = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: out))
  print("wrote \(out)")
}

make("DEV", NSColor(srgbRed: 0.85, green: 0.25, blue: 0.20, alpha: 1), "assets/icon-dev.png")
make("PREVIEW", NSColor(srgbRed: 0.20, green: 0.40, blue: 0.80, alpha: 1), "assets/icon-preview.png")
