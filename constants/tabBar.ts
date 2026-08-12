import { spacing } from './theme';

// Floating pill tab bar dimensions — shared between the tab layout (which
// positions the pill) and every tab screen (which needs to pad its own
// content so the last item isn't hidden behind it). A docked tab bar
// reserves its own layout space automatically; an absolutely-positioned
// floating one doesn't, so each screen has to account for it manually.
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_BOTTOM_MARGIN = spacing.sm;
// A compact island, not an edge-to-edge bar — each regular icon (40px
// circle) gets a snug slot; the raised Scan button (58px) gets a wider one
// so it doesn't crowd its neighbors. Total is centered on screen at render
// time (see _layout.tsx), not pinned to fixed side margins.
export const TAB_BAR_ITEM_WIDTH = 56;
export const TAB_BAR_SCAN_ITEM_WIDTH = 64;
export const TAB_BAR_WIDTH = TAB_BAR_ITEM_WIDTH * 4 + TAB_BAR_SCAN_ITEM_WIDTH;
// Total clearance a screen's bottom-most content needs to reserve: the
// pill's own height and margin, plus a little breathing room above it.
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN + spacing.sm;
