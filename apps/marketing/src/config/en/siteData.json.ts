import { type SiteDataProps } from "../types/configDataTypes";

const siteData: SiteDataProps = {
  name: "Webkit",
  title: "Webkit — Client Consultation & Proposal Platform for Web Agencies",
  description:
    "Create professional consultations, proposals, quotations, contracts and invoices for your web agency. Customizable forms, agency branding, AI-powered generation, and Content Intelligence with SEO audits. Free tier available.",

  author: {
    name: "Webkit",
    email: "hello@webkit.au",
    twitter: "webkit",
  },

  // OG image fallback for pages that don't supply their own. 1200x630 PNG —
  // copied from apps/service-client/static/og-image.png in this commit.
  defaultImage: {
    src: "/og-image.png",
    alt: "Webkit — Client Consultation & Proposal Platform",
  },
};

export default siteData;
