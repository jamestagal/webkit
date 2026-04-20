/**
 * Pure color utilities — no server dependencies.
 *
 * These live in `$lib/utils/` (not inside form-renderer/) so any consumer —
 * a public-facing document component, a branding preview wrapper, an email
 * template — can import them without pulling form-renderer code.
 *
 * `hexToHsl` previously lived at `$lib/components/form-renderer/utils/theme-generator.ts`;
 * that module now re-exports from here for backwards compatibility.
 */

/**
 * Convert hex color to HSL string in DaisyUI's space-separated format.
 *
 * Input: `"#220090"` or `"#220"` (3 or 6 hex digits, leading `#` optional).
 * Output: `"H S% L%"` (e.g. `"220 90% 56%"`) — NOT comma-separated. Use
 * {@link toCommaHsl} to produce the comma-separated variant DaisyUI expects
 * for `--p` / `--s` / `--a` custom properties.
 */
export function hexToHsl(hex: string): string {
	// Remove # if present
	const cleanHex = hex.replace(/^#/, "");

	// Parse hex to RGB
	let r: number, g: number, b: number;
	if (cleanHex.length === 3) {
		const c0 = cleanHex.charAt(0);
		const c1 = cleanHex.charAt(1);
		const c2 = cleanHex.charAt(2);
		r = parseInt(c0 + c0, 16);
		g = parseInt(c1 + c1, 16);
		b = parseInt(c2 + c2, 16);
	} else {
		r = parseInt(cleanHex.substring(0, 2), 16);
		g = parseInt(cleanHex.substring(2, 4), 16);
		b = parseInt(cleanHex.substring(4, 6), 16);
	}

	// Convert to 0-1 range
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	// Convert to final format
	const hDegrees = Math.round(h * 360);
	const sPercent = Math.round(s * 100);
	const lPercent = Math.round(l * 100);

	return `${hDegrees} ${sPercent}% ${lPercent}%`;
}

/**
 * Convert space-separated HSL ("H S% L%") to the comma-separated format
 * DaisyUI's `--p` / `--s` / `--a` custom properties expect ("H, S%, L%").
 *
 * The theme-generator inside `form-renderer` uses this via `toCommaHSL`
 * when building the theme stylesheet; this export is the same conversion,
 * pulled up for reuse by document wrappers that inject `--p` directly.
 */
export function toCommaHsl(hsl: string): string {
	return hsl.trim().split(/\s+/).join(", ");
}

/**
 * One-shot: hex → DaisyUI-ready comma-separated HSL.
 *
 * Equivalent to `toCommaHsl(hexToHsl(hex))`. Convenience for wrapper
 * components that inject `--p` / `--s` / `--a` directly from branding hex.
 */
export function hexToDaisyHsl(hex: string): string {
	return toCommaHsl(hexToHsl(hex));
}
