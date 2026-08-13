// Category color scale (spec 4a): every category is defined by a single hue H,
// the lightness/chroma are FIXED so no category shouts louder than another.
//
//   fill  = oklch(0.95 0.035 H)  — chip / label background
//   text  = oklch(0.45 0.09  H)  — text on the fill
//   solid = oklch(0.62 0.10  H)  — left bar, legend dot
//
// The hue is derived from the work-type color stored in the DB, so admins keep
// picking colors as before — the grid just normalizes them onto this scale.
// Conversion is done here in JS and emitted as hex, so it renders identically
// on older kiosk browsers without CSS oklch() support.

export interface CategoryColors {
  fill: string;
  text: string;
  solid: string;
  tint: string; // very light opaque wash — row banding in the shifts grid
}

// ── sRGB ↔ OKLab (standard Björn Ottosson matrices) ─────────────────────────

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Hue angle (degrees) of a hex color in OKLCH; null for grays/invalid input. */
function hexToOklchHue(hex: string): number | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = srgbToLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(clean.slice(4, 6), 16) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  const chroma = Math.sqrt(a * a + bb * bb);
  if (chroma < 0.01) return null; // effectively gray — no meaningful hue
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return hue < 0 ? hue + 360 : hue;
}

function oklchToHex(L: number, C: number, H: number): string {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const toByte = (c: number) => {
    const v = Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255);
    return v.toString(16).padStart(2, '0');
  };
  return `#${toByte(r)}${toByte(g)}${toByte(bl)}`;
}

const NEUTRAL: CategoryColors = { fill: '#eef1f4', text: '#7d8792', solid: '#8a929c', tint: '#faf9f7' };

const cache = new Map<string, CategoryColors>();

/** Normalized category triple derived from any hex color's hue. */
export function catColors(hex: string | null | undefined): CategoryColors {
  if (!hex) return NEUTRAL;
  const hit = cache.get(hex);
  if (hit) return hit;
  const hue = hexToOklchHue(hex);
  const result = hue == null ? NEUTRAL : {
    fill: oklchToHex(0.95, 0.035, hue),
    text: oklchToHex(0.45, 0.09, hue),
    solid: oklchToHex(0.62, 0.10, hue),
    tint: oklchToHex(0.975, 0.018, hue),
  };
  cache.set(hex, result);
  return result;
}
