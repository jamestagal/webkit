/**
 * Theme Generator Utility
 *
 * Generates DaisyUI theme CSS from AgencyBranding configuration.
 */

import type { AgencyBranding } from "$lib/types/branding";

// Re-export the pure hex→HSL converter from its shared-utility home so
// existing consumers (FormBranding etc.) keep working unchanged. New
// consumers should import directly from $lib/utils/color.
export { hexToHsl } from "$lib/utils/color";

export const radiusMap = {
	none: "0",
	sm: "0.25rem",
	md: "0.5rem",
	lg: "0.75rem",
	xl: "1rem",
	full: "9999px",
} as const;

export const cardStyleMap = {
	flat: "",
	bordered: "border border-base-300",
	elevated: "shadow-lg",
} as const;

/**
 * Convert space-separated HSL "H S% L%" to comma-separated "H, S%, L%"
 */
function toCommaHSL(hsl: string): string {
	const parts = hsl.trim().split(/\s+/);
	return parts.join(", ");
}

/**
 * Generates a DaisyUI theme CSS string from AgencyBranding
 * Uses comma-separated HSL values for better browser compatibility
 */
export function generateDaisyTheme(themeName: string, branding: AgencyBranding): string {
	const c = branding.colors;
	const b = branding.borders || {};
	const btn = branding.buttons || {};
	const t = branding.typography || {};

	// Auto-calculate missing colors
	const primaryFocus = c.primaryFocus || darkenHSL(c.primary, 10);
	const primaryContent = c.primaryContent || getContrastColor(c.primary);

	const secondary = c.secondary || shiftHue(c.primary, 30);
	const secondaryFocus = c.secondaryFocus || darkenHSL(secondary, 10);
	const secondaryContent = c.secondaryContent || getContrastColor(secondary);

	const accent = c.accent || shiftHue(c.primary, 180);
	const accentFocus = c.accentFocus || darkenHSL(accent, 10);
	const accentContent = c.accentContent || getContrastColor(accent);

	const neutral = c.neutral || "220 14% 20%";
	const neutralFocus = c.neutralFocus || darkenHSL(neutral, 5);
	const neutralContent = c.neutralContent || "0 0% 100%";

	const base100 = c.base100;
	const base200 = c.base200 || darkenHSL(base100, 3);
	const base300 = c.base300 || darkenHSL(base100, 8);
	const baseContent = c.baseContent || getContrastColor(base100);

	// Semantic colors with defaults
	const info = c.info || "198 93% 60%";
	const success = c.success || "158 64% 52%";
	const warning = c.warning || "43 96% 56%";
	const error = c.error || "0 91% 71%";

	// Border radius
	const roundedBox = radiusMap[b.cardRadius || b.radius || "lg"];
	const roundedBtn = radiusMap[b.buttonRadius || b.radius || "md"];

	// Button styles
	const btnTextCase = btn.textTransform || "none";
	const btnFocusScale = btn.focusScale || 0.98;

	// Typography
	const fontBody = t.bodyFont || "system-ui, sans-serif";
	const fontHeading = t.headingFont || fontBody;

	// Convert all HSL values to comma-separated format
	return `
    [data-theme="${themeName}"] {
      /* Primary */
      --p: ${toCommaHSL(c.primary)};
      --pf: ${toCommaHSL(primaryFocus)};
      --pc: ${toCommaHSL(primaryContent)};

      /* Secondary */
      --s: ${toCommaHSL(secondary)};
      --sf: ${toCommaHSL(secondaryFocus)};
      --sc: ${toCommaHSL(secondaryContent)};

      /* Accent */
      --a: ${toCommaHSL(accent)};
      --af: ${toCommaHSL(accentFocus)};
      --ac: ${toCommaHSL(accentContent)};

      /* Neutral */
      --n: ${toCommaHSL(neutral)};
      --nf: ${toCommaHSL(neutralFocus)};
      --nc: ${toCommaHSL(neutralContent)};

      /* Base */
      --b1: ${toCommaHSL(base100)};
      --b2: ${toCommaHSL(base200)};
      --b3: ${toCommaHSL(base300)};
      --bc: ${toCommaHSL(baseContent)};

      /* Semantic */
      --in: ${toCommaHSL(info)};
      --su: ${toCommaHSL(success)};
      --wa: ${toCommaHSL(warning)};
      --er: ${toCommaHSL(error)};

      /* Shapes */
      --rounded-box: ${roundedBox};
      --rounded-btn: ${roundedBtn};
      --rounded-badge: 1.9rem;

      /* Buttons */
      --btn-focus-scale: ${btnFocusScale};
      --btn-text-case: ${btnTextCase};
      --animation-btn: 0.2s;
      --animation-input: 0.2s;

      /* Typography */
      --font-body: ${fontBody};
      --font-heading: ${fontHeading};
    }
  `;
}

/**
 * Darken an HSL color by reducing lightness
 */
function darkenHSL(hsl: string, amount: number): string {
	const [h, s, l] = parseHSL(hsl);
	return `${h} ${s}% ${Math.max(0, l - amount)}%`;
}

/**
 * Shift hue of an HSL color
 */
function shiftHue(hsl: string, degrees: number): string {
	const [h, s, l] = parseHSL(hsl);
	return `${(h + degrees) % 360} ${s}% ${l}%`;
}

/**
 * Get contrasting text color (black or white)
 */
function getContrastColor(hsl: string): string {
	const [, , l] = parseHSL(hsl);
	// Simple luminance check - if lightness > 60%, use dark text
	return l > 60 ? "0 0% 0%" : "0 0% 100%";
}

/**
 * Parse HSL string into components
 */
function parseHSL(hsl: string): [number, number, number] {
	const parts = hsl.split(/\s+/);
	const h = parseFloat(parts[0] ?? "0") || 0;
	const s = parseFloat(parts[1] ?? "0") || 0;
	const l = parseFloat(parts[2] ?? "0") || 0;
	return [h, s, l];
}

/**
 * Simple hash function for theme name
 */
export function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36).substring(0, 8);
}

