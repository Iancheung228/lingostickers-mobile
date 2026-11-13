// Sheets are one component (lesson 8): every drawn affordance (grabber, scrim)
// works and every exit routes through the BottomSheet guard. This module is the
// ui/ entry point so screens import their primitives from one place; it adds no
// behaviour of its own. Use the same ref handle (`close`, `settle`) as before.
export { default as Sheet } from '@/components/BottomSheet';
export type { BottomSheetHandle as SheetHandle } from '@/components/BottomSheet';
