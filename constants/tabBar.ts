// Floating pill tab bar dimensions (C-look 4): five equal slots, mirror
// symmetric, the camera disc dead centre. Shared between the tab layout (which
// positions the pill) and every tab screen (which pads its own content so the
// last item isn't hidden behind it): an absolutely-positioned bar reserves no
// layout space of its own.
export const TAB_BAR_SLOTS = 5;
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_WIDTH = 344;
export const TAB_BAR_ITEM_WIDTH = TAB_BAR_WIDTH / TAB_BAR_SLOTS; // 68.8
// The disc is 60pt and overhangs the pill by 14pt.
export const TAB_BAR_DISC = 60;
export const TAB_BAR_DISC_OVERHANG = 14;
/** Gap between the pill and the bottom of the screen (home indicator included). */
export const TAB_BAR_FLOOR = 30;
/** Distance of the pill's bottom edge from the screen bottom. */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom - 4, 16);
}
// Clearance a screen adds ON TOP of `insets.bottom`: pill (68) + its floor
// (30 - 4 below the inset) + 24 of air, minus a little for devices without an
// inset. Measured against iPhone 18 Pro (inset 34): bar top at 98, content ends at 130.
export const TAB_BAR_CLEARANCE = 96;
