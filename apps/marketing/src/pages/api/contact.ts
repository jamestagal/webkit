import type { APIRoute } from "astro";

// Per-route prerender flip — this is the only non-static endpoint in the
// marketing site. Activates the #15411 risk mitigation: env access uses
// context.locals.runtime.env (the canonical Astro+Cloudflare runtime API
// access pattern that does NOT require importing from cloudflare:workers).
//
// import.meta.env.RESEND_API_KEY would BAKE the secret into the bundled JS
// at build time — security regression. Don't switch to it.
//
// Wrangler secret binding: this expects RESEND_API_KEY to be set on the
// webkit-marketing Worker. One-time setup:
//
//   pnpm --filter @webkit/marketing exec wrangler secret put RESEND_API_KEY
//
// Subsequent deploys inherit. Verified pre-deploy via wrangler secret list.
export const prerender = false;

const FROM = "Webkit Contact <noreply@webkit.au>";
const TO = ["hello@webkit.au"];

interface ContactPayload {
  firstName?: string;
  lastName?: string;
  company?: string;
  email: string;
  message: string;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeMarkdown(value: string): string {
  // Strip newlines from single-line fields so the structured-body parser
  // (the future ContactService migration sed-job) can rely on field-per-line.
  // Multi-line message is the one exception — it goes after **Message:** label.
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildEmailBody(payload: Required<Omit<ContactPayload, "firstName" | "lastName">> & {
  firstName: string;
  lastName: string;
}): string {
  // Structured markdown — parse-friendly for future ContactService migration
  // (regex-extract field values, batch-insert via the new RPC).
  return [
    `**Name:** ${escapeMarkdown(`${payload.firstName} ${payload.lastName}`.trim() || "(not provided)")}`,
    `**Email:** ${escapeMarkdown(payload.email)}`,
    `**Company:** ${escapeMarkdown(payload.company || "(not provided)")}`,
    "",
    "**Message:**",
    payload.message.trim(),
  ].join("\n");
}

export const POST: APIRoute = async (context) => {
  // Resend secret bound on the Worker via wrangler secret put.
  // context.locals.runtime is provided by @astrojs/cloudflare for both
  // Workers AssetsBinding (output: 'static' + this prerender=false route)
  // and full SSR routes.
  const apiKey = (
    context.locals as { runtime?: { env?: Record<string, string> } }
  ).runtime?.env?.RESEND_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, {
      ok: false,
      error: "Email service is not configured. Please email hello@webkit.au directly.",
    });
  }

  let payload: ContactPayload;
  try {
    const formData = await context.request.formData();
    payload = {
      firstName: (formData.get("contact__fname") as string | null) ?? undefined,
      lastName: (formData.get("contact__lname") as string | null) ?? undefined,
      company: (formData.get("contact__company") as string | null) ?? undefined,
      email: (formData.get("contact__email") as string) ?? "",
      message: (formData.get("contact__message") as string) ?? "",
    };
  } catch {
    return jsonResponse(400, { ok: false, error: "Could not parse form submission." });
  }

  if (!payload.email || !payload.message) {
    return jsonResponse(400, {
      ok: false,
      error: "Email and message are required.",
    });
  }

  const firstName = payload.firstName ?? "";
  const lastName = payload.lastName ?? "";
  const subject = `[Webkit Contact] ${`${firstName} ${lastName}`.trim() || payload.email}${
    payload.company ? ` — ${escapeMarkdown(payload.company)}` : ""
  }`;
  const text = buildEmailBody({
    firstName,
    lastName,
    company: payload.company ?? "",
    email: payload.email,
    message: payload.message,
  });

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      reply_to: payload.email,
      subject,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const errorBody = await resendResponse.text().catch(() => "");
    console.error(
      `Resend API error ${resendResponse.status} ${resendResponse.statusText}: ${errorBody}`,
    );
    return jsonResponse(502, {
      ok: false,
      error: "Could not send your message. Please try again or email hello@webkit.au directly.",
    });
  }

  return jsonResponse(200, { ok: true });
};
