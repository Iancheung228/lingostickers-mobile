// ---------------------------------------------------------------------------
// The predefined scan cases the live test runs against.
//
// These are deliberately HARDER than an average scan, because the failure they
// exist to catch is the one that decided the provider migration: naming the
// wrong object. Three of the six put a more eye-catching thing next to the
// thing the user actually selected — a cat beside a mug, a whole market stall
// around three cauliflowers, a thermos in deep shadow — which is exactly where
// the previous provider failed (it answered "rabbit" for the mug, because a
// rabbit was printed on it, and "coin bank" for the thermos).
//
// Photographs are fetched from Wikimedia Commons and cached locally, so the
// repository stays light and the cases stay reproducible. `expect` is an
// accept-list of reasonable English names, not one right answer — the test is
// "did it identify the selected object", not "did it pick our favourite word".
// ---------------------------------------------------------------------------

export interface ScanCase {
  name: string;
  /** Wikimedia Commons thumbnail URL. */
  url: string;
  /** The user's selection, as fractions of the full image: [x0, y0, x1, y1]. */
  box: [number, number, number, number];
  /** Any of these English translations counts as correctly identified. */
  expect: string[];
  /** Why this photo is in the set. */
  why: string;
}

export const SCAN_CASES: ScanCase[] = [
  {
    name: 'mug_desk',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Coffee_Mug_on_Desk.jpg/1920px-Coffee_Mug_on_Desk.jpg',
    box: [0.28, 0.1, 0.87, 0.95],
    expect: ['tumbler', 'cup', 'mug', 'goblet', 'gobelet', 'travel mug', 'flask', 'thermos', 'beaker', 'water bottle', 'drinking cup'],
    why: 'the easy case — the selected object is also the most salient one',
  },
  {
    name: 'cat_mug',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Larry_the_cat_lying_on_a_desk_next_to_a_coffee_mug_%28DSC_0055%29.jpg/1920px-Larry_the_cat_lying_on_a_desk_next_to_a_coffee_mug_%28DSC_0055%29.jpg',
    box: [0.63, 0.34, 0.98, 0.88],
    expect: ['mug', 'cup', 'teacup', 'coffee mug', 'coffee cup'],
    why: 'a large cat sits beside the selected mug, and a rabbit is printed on the mug — two ways to answer the wrong question',
  },
  {
    name: 'breakfast',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Breakfast_chiaroscuro.JPG/1920px-Breakfast_chiaroscuro.JPG',
    box: [0.77, 0.35, 0.98, 0.76],
    expect: ['thermos', 'flask', 'coffee pot', 'coffeepot', 'carafe', 'jug', 'pot', 'vacuum flask', 'percolator', 'coffee maker', 'kettle', 'pitcher', 'teapot', 'tea pot'],
    why: 'hard chiaroscuro lighting; the object is in shadow on a cluttered table',
  },
  {
    name: 'bicycle',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Old_Bicycle_Leaning_on_Wall.jpg/1920px-Old_Bicycle_Leaning_on_Wall.jpg',
    box: [0.35, 0.5, 0.81, 0.88],
    expect: ['bicycle', 'bike', 'cycle', 'pushbike'],
    why: 'outdoors, low contrast against a concrete wall',
  },
  {
    name: 'windowsill',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Bright_windowsill_%28Unsplash%29.jpg/1920px-Bright_windowsill_%28Unsplash%29.jpg',
    box: [0.4, 0.5, 0.92, 0.97],
    expect: ['flowerpot', 'flower pot', 'plant pot', 'pot', 'planter', 'pot cover', 'cachepot', 'plant', 'houseplant', 'potted plant'],
    why: 'two near-identical objects side by side; strong backlight',
  },
  {
    name: 'market',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Vegetable_Stall%2C_Brigg_Market_-_geograph.org.uk_-_1725905.jpg',
    box: [0.34, 0.7, 0.64, 0.97],
    expect: ['cauliflower', 'cauliflowers'],
    why: 'a stall of thirty competing objects; the selection is three of them',
  },
];
