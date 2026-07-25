import { spacing } from './theme';

// Floating pill tab bar dimensions — shared between the tab layout (which
// positions the pill) and every tab screen (which needs to pad its own
// content so the last item isn't hidden behind it). A docked tab bar
// reserves its own layout space automatically; an absolutely-positioned
// floating one doesn't, so each screen has to account for it manually.
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_SIDE_MARGIN = spacing.lg;
export const TAB_BAR_BOTTOM_MARGIN = spacing.md;
// Total clearance a screen's bottom-most content needs to reserve: the
// pill's own height and margin, plus a little breathing room above it.
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN + spacing.sm;
