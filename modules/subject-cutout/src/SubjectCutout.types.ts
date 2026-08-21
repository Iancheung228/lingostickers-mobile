export interface CutoutPoint {
  x: number;
  y: number;
}

/**
 * Why the device declined to produce a cutout. Every one of these routes to
 * the server path — none of them is an error the user should ever see. They
 * stay distinct because the *mix* of reasons across real scans is the signal
 * that tells us whether the gate's thresholds are set right.
 */
export type CutoutFailureReason =
  /** Below iOS 17 — Vision's instance mask request doesn't exist. */
  | 'unsupported-os'
  /** Vision's segmentation models aren't installed on the Simulator. */
  | 'simulator'
  /** The native module isn't in this build (e.g. an older dev client). */
  | 'unavailable'
  /** The source file couldn't be decoded. */
  | 'load-failed'
  /** Vision threw while running. */
  | 'vision-failed'
  /** Vision found no foreground objects: low contrast, flat surfaces, signs. */
  | 'no-instances'
  /** Objects were found, but none agree with what the user selected. */
  | 'no-matching-instance'
  /** A matte came back but it kept almost nothing, or almost everything. */
  | 'degenerate-mask'
  /** The PNG couldn't be written. */
  | 'encode-failed';

export interface CutoutOptions {
  /** Local file URI of the cropped source photo. */
  uri: string;
  /** The user's selection, in the pixel space of `sourceWidth`/`sourceHeight`. */
  polygon: CutoutPoint[];
  /** Pixel dimensions the polygon was measured against. */
  sourceWidth: number;
  sourceHeight: number;
  /** Longest side the photo is decoded and segmented at. */
  maxDimension?: number;
  /** Longest side of the delivered PNG. */
  outputMaxDimension?: number;
  /** Minimum share of an instance that must fall inside the selection. */
  minContainment?: number;
  /** Minimum share of the selection the kept instances must fill. */
  minCoverage?: number;
  /** Reject a matte keeping less than this share of its canvas. */
  minSubjectAreaRatio?: number;
  /** Reject a matte keeping more than this share — nothing was separated. */
  maxSubjectAreaRatio?: number;
  /**
   * Skip Vision and build the matte from the selection itself, solving alpha
   * in a band around the traced loop. For when Vision found nothing but the
   * user still told us where the object is.
   */
  selectionAsMask?: boolean;
}

export interface CutoutSuccess {
  ok: true;
  /** Local file URI of the finished, styled PNG with a transparent background. */
  uri: string;
  width: number;
  height: number;
  /** How many foreground objects Vision found in the whole frame. */
  instanceCount: number;
  /** How many of them the selection kept. */
  selectedCount: number;
  /** Share of the kept instances that sits inside the selection. */
  containment: number;
  /** Share of the selection the kept instances fill. */
  coverage: number;
  /** Share of the working canvas the matte keeps. */
  subjectAreaRatio: number;
  durationMs: number;
  /** Per-stage breakdown, so a slow run is diagnosable from one scan. */
  decodeMs: number;
  visionMs: number;
  refineMs: number;
  styleMs: number;
  encodeMs: number;
  /** Pixel dimensions the pipeline actually worked at. */
  workingWidth: number;
  workingHeight: number;
}

export interface CutoutFailure {
  ok: false;
  reason: CutoutFailureReason;
  detail?: string;
  /** Present when Vision ran — the numbers behind the gate's refusal. */
  instanceCount?: number;
  containment?: number;
  coverage?: number;
  durationMs?: number;
}

export type CutoutResult = CutoutSuccess | CutoutFailure;
