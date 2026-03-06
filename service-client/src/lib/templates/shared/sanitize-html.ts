/**
 * Lightweight HTML sanitizer for PDF templates.
 * Allowlist-based: only permits safe structural tags.
 * Strips all style attributes and event handlers.
 * Zero dependencies.
 */

const ALLOWED_TAGS = new Set([
	"p",
	"br",
	"ul",
	"ol",
	"li",
	"strong",
	"em",
	"b",
	"i",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"table",
	"thead",
	"tbody",
	"tr",
	"td",
	"th",
	"div",
	"span",
	"blockquote",
	"a",
]);

const DANGEROUS_TAGS = new Set([
	"script",
	"iframe",
	"object",
	"embed",
	"form",
	"input",
	"textarea",
	"select",
	"button",
	"link",
	"meta",
	"style",
	"base",
	"applet",
	"svg",
	"math",
]);

/**
 * Sanitize HTML content by stripping disallowed tags and all attributes
 * except href on <a> tags (validated to http/https only).
 */
export function sanitizeHtml(html: string): string {
	if (!html) return "";

	// Remove dangerous tags and their content entirely
	let result = html;
	for (const tag of DANGEROUS_TAGS) {
		// Remove opening + content + closing tag
		const contentRegex = new RegExp(
			`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`,
			"gi",
		);
		result = result.replace(contentRegex, "");
		// Remove self-closing variants
		const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
		result = result.replace(selfClosingRegex, "");
	}

	// Process remaining tags: keep allowed, strip others
	result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName: string) => {
		const lower = tagName.toLowerCase();

		if (!ALLOWED_TAGS.has(lower)) {
			// Strip the tag but keep content (already handled dangerous tags above)
			return "";
		}

		// For closing tags, just return clean closing tag
		if (match.startsWith("</")) {
			return `</${lower}>`;
		}

		// For <a> tags, preserve only safe href
		if (lower === "a") {
			const hrefMatch = match.match(/href\s*=\s*"([^"]*)"/i) ||
				match.match(/href\s*=\s*'([^']*)'/i);
			if (hrefMatch && hrefMatch[1]) {
				const href = hrefMatch[1];
				// Only allow http/https links
				if (href.startsWith("http://") || href.startsWith("https://")) {
					return `<a href="${href}">`;
				}
			}
			return "<a>";
		}

		// For <br>, return self-closing
		if (lower === "br") {
			return "<br>";
		}

		// Return clean tag with no attributes (strips style, on*, class, id, etc.)
		const isSelfClosing = match.endsWith("/>");
		return isSelfClosing ? `<${lower}/>` : `<${lower}>`;
	});

	// Remove any remaining on* event attributes that might have slipped through
	result = result.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");

	return result;
}
