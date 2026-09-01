import { requireOptionalNativeModule } from 'expo-modules-core';

import type { CutoutOptions, CutoutResult } from './src/SubjectCutout.types';

export * from './src/SubjectCutout.types';

interface SubjectCutoutNativeModule {
  isAvailable(): boolean;
  cutout(options: CutoutOptions): Promise<CutoutResult>;
}

// Optional, not required: a dev client built before this module existed is a
// completely normal thing to be running, and it should fall through to the
// server path rather than red-screening on import.
const native = requireOptionalNativeModule<SubjectCutoutNativeModule>('SubjectCutout');

/**
 * Whether this device can cut out subjects locally. False on Android, on the
 * iOS Simulator, below iOS 17, and in any build without the native module.
 */
export function isAvailable(): boolean {
  if (!native) return false;
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Segment the subject the user selected and return a styled sticker PNG.
 *
 * Never throws: a refusal is a value, because "the device declined" is an
 * ordinary branch in this pipeline rather than an exceptional one.
 */
export async function cutout(options: CutoutOptions): Promise<CutoutResult> {
  if (!native) return { ok: false, reason: 'unavailable' };
  try {
    return await native.cutout(options);
  } catch (error) {
    return {
      ok: false,
      reason: 'vision-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
