import { type CollectionEntry } from "astro:content";

import { defaultLocale } from "@/config/siteSettings.json";
import { getTranslatedData } from "@/js/translationUtils";

const siteData = getTranslatedData("siteData", defaultLocale);

interface GeneralProps {
  type: "general";
}

export interface BlogProps {
  type: "blog";
  postFrontmatter: CollectionEntry<"blog">["data"];
  image: ImageMetadata;
  authors: CollectionEntry<"authors">[];
  canonicalUrl: URL;
}

export type JsonLDProps = BlogProps | GeneralProps;

// SoftwareApplication schema for the marketing site. Mirrors the inventory's
// JSON-LD spec from the SvelteKit landing — preserves SEO continuity post-
// DNS cutover (search engines saw the same schema shape on the old SvelteKit
// surface; nothing changes for them when the apex flips).
const SOFTWARE_APPLICATION_LD = {
  "@context": "https://schema.org/",
  "@type": "SoftwareApplication",
  name: "Webkit",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Multi-tenant SaaS platform for web agencies — consultations, proposals, quotations, contracts, invoices, AI generation, Content Intelligence and SEO audits.",
  url: "https://webkit.au",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "199",
    priceCurrency: "AUD",
    offerCount: "4",
  },
  featureList:
    "Consultations, Proposals, Quotations, Contracts, Invoices, Custom Forms, Client Management, AI Generation, Content Intelligence, SEO Audits",
};

export default function jsonLDGenerator(props: JsonLDProps): string {
  const { type } = props;
  if (type === "blog") {
    const { postFrontmatter, image, authors, canonicalUrl } = props as BlogProps;

    const authorsJsonLdArray = authors.map((author) => ({
      "@type": "Person",
      name: author.data.name,
      url: author.data.authorLink,
    }));

    const authorsJsonLd =
      authorsJsonLdArray.length === 1 ? authorsJsonLdArray[0] : authorsJsonLdArray;

    return `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl.toString(),
      },
      headline: postFrontmatter.title,
      description: postFrontmatter.description,
      image: image.src,
      author: authorsJsonLd,
      datePublished: postFrontmatter.pubDate,
      dateModified: postFrontmatter.updatedDate,
      publisher: {
        "@type": "Organization",
        name: siteData.name,
        url: import.meta.env.SITE,
      },
    })}</script>`;
  }

  return `<script type="application/ld+json">${JSON.stringify(SOFTWARE_APPLICATION_LD)}</script>`;
}
