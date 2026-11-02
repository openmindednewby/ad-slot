/** Reserved pixel size per ad format; the box never takes any other height. */
export const AD_FORMATS = {
  'mobile-banner': { width: 320, height: 100 },
  rectangle: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
} as const;

export type AdFormat = keyof typeof AD_FORMATS;

/** Style text that reserves a format's box; put it in server markup so the box exists before any script. */
export function adSlotCssText(format: AdFormat): string {
  const { width, height } = AD_FORMATS[format];
  return `display:block;width:100%;max-width:${width}px;height:${height}px;overflow:hidden;`;
}
