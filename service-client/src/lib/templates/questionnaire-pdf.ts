/**
 * Questionnaire PDF HTML Template
 *
 * Generates professional A4 questionnaire PDF for Gotenberg conversion.
 * Uses inline styles for maximum PDF compatibility.
 */

import type { QuestionnaireResponse, Agency, AgencyProfile } from "$lib/server/schema";
import type { EffectiveBranding } from "$lib/server/document-branding";

export interface QuestionnairePdfData {
	questionnaire: QuestionnaireResponse;
	agency: Agency;
	profile: AgencyProfile | null;
	/** Optional branding override - if provided, takes precedence over agency branding */
	brandingOverride?: EffectiveBranding;
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string | null): string {
	if (!date) return "Not provided";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/**
 * Get status badge styling
 */
function getStatusStyle(status: string): { bg: string; text: string } {
	switch (status) {
		case "completed":
			return { bg: "#dcfce7", text: "#166534" };
		case "in_progress":
			return { bg: "#fef3c7", text: "#92400e" };
		default:
			return { bg: "#f3f4f6", text: "#6b7280" };
	}
}

/**
 * Format a value for display, handling empty/null values
 */
function formatValue(value: unknown): string {
	if (value === null || value === undefined || value === "") {
		return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>';
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (typeof value === "string") {
		// Escape HTML and preserve line breaks
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\n/g, "<br>");
	}
	return String(value);
}

/**
 * Format yes/no values with visual indicator
 */
function formatYesNo(value: unknown): string {
	if (value === null || value === undefined || value === "") {
		return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>';
	}
	const isYes = value === "yes" || value === true || value === "true";
	const isNo = value === "no" || value === false || value === "false";

	if (isYes) {
		return '<span style="display: inline-block; padding: 2px 10px; background: #dcfce7; color: #166534; border-radius: 4px; font-weight: 500;">Yes</span>';
	}
	if (isNo) {
		return '<span style="display: inline-block; padding: 2px 10px; background: #fee2e2; color: #991b1b; border-radius: 4px; font-weight: 500;">No</span>';
	}
	return formatValue(value);
}

/**
 * Render a field row
 */
function renderField(label: string, value: unknown, isYesNo = false): string {
	const formattedValue = isYesNo ? formatYesNo(value) : formatValue(value);
	return `
		<div style="margin-bottom: 16px;">
			<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${label}</div>
			<div style="font-size: 14px; color: #374151; line-height: 1.6;">${formattedValue}</div>
		</div>
	`;
}

/**
 * Render a section
 */
function renderSection(
	number: number,
	title: string,
	content: string,
	accentColor: string,
): string {
	return `
		<div style="margin-bottom: 32px; page-break-inside: avoid;">
			<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">
				<div style="width: 32px; height: 32px; background: ${accentColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${number}</div>
				<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">${title}</h2>
			</div>
			<div style="padding-left: 44px;">
				${content}
			</div>
		</div>
	`;
}

/**
 * Generate questionnaire PDF HTML
 */
export function generateQuestionnairePdfHtml(data: QuestionnairePdfData): string {
	const { questionnaire, agency, profile, brandingOverride } = data;
	const responses = (questionnaire.responses || {}) as Record<string, unknown>;
	const statusStyle = getStatusStyle(questionnaire.status);

	// Use branding override if provided, otherwise fall back to agency branding
	const logoUrl = brandingOverride?.logoUrl || agency.logoUrl;
	const accentColor = brandingOverride?.primaryColor || agency.primaryColor || "#6366f1";

	// Section 1: Personal Information
	const section1 = [
		renderField("First Name", responses.first_name),
		renderField("Last Name", responses.last_name),
		renderField("Email", responses.email),
	].join("");

	// Section 2: Company Details
	const section2 = [
		renderField("Company Name", responses.company_name),
		renderField("Registered Address", responses.registered_address),
	].join("");

	// Section 3: Information to be Displayed
	const section3 = [
		renderField("Business Name to Display", responses.displayed_business_name),
		renderField("Address to Display", responses.displayed_address),
		renderField("Phone Number", responses.displayed_phone),
		renderField("Email Address", responses.displayed_email),
		renderField("Social Media Accounts", responses.social_media_accounts),
		renderField("Opening Hours", responses.opening_hours),
	].join("");

	// Section 4: Domain & Technical
	const section4 = [
		renderField("Do you have a domain?", responses.has_domain, true),
		renderField("Domain Name", responses.domain_name),
		renderField("Do you have Google Business Profile?", responses.has_google_business, true),
	].join("");

	// Section 5: About Your Business
	const section5 = [
		renderField("Your Business Story", responses.business_story),
		renderField("Business Email Addresses", responses.business_emails),
		renderField("Areas Served", responses.areas_served),
		renderField("Target Customers", responses.target_customers),
		renderField("Top Services/Products", responses.top_services),
		renderField("Other Services/Products", responses.other_services),
		renderField("What Makes You Different", responses.differentiators),
		renderField("Statistics & Awards", responses.statistics_awards),
		renderField("Additional Business Details", responses.additional_business_details),
	].join("");

	// Section 6: Website Content
	const section6 = [
		renderField("Pages Wanted on Website", responses.pages_wanted),
		renderField("Customer Actions", responses.customer_actions),
		renderField("Key Information to Display", responses.key_information),
		renderField("Calls to Action", responses.calls_to_action),
		renderField("Regularly Updated Content", responses.regularly_updated_content),
		renderField("Additional Content Details", responses.additional_content_details),
	].join("");

	// Section 7: Website Design
	const section7 = [
		renderField("Competitor Websites", responses.competitor_websites),
		renderField("Reference Websites You Like", responses.reference_websites),
		renderField("Aesthetic Description", responses.aesthetic_description),
		renderField("Branding Guidelines", responses.branding_guidelines),
		renderField("Additional Design Details", responses.additional_design_details),
	].join("");

	// Section 8: Final Details
	const section8 = [
		renderField("Timeline/Deadline", responses.timeline),
		renderField("Want Google Analytics?", responses.google_analytics, true),
		renderField("How Did You Hear About Us?", responses.referral_source),
		renderField("Interest in Other Services", responses.other_services_interest),
		renderField("Marketing Permissions", responses.marketing_permissions),
	].join("");

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Questionnaire - ${questionnaire.clientBusinessName || "Response"}</title>
	<style>
		@page {
			size: A4;
			margin: 15mm;
		}
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: 14px;
			line-height: 1.5;
			color: #374151;
			background: white;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
		}
	</style>
</head>
<body>
	<div class="container">
		<!-- Header -->
		<div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 3px solid ${accentColor};">
			<div>
				${
					logoUrl
						? `<img src="${logoUrl}" alt="${agency.name}" style="max-height: 50px; max-width: 180px; object-fit: contain; margin-bottom: 8px;">`
						: `<div style="font-size: 22px; font-weight: bold; color: ${accentColor};">${agency.name}</div>`
				}
			</div>
			<div style="text-align: right;">
				<div style="font-size: 22px; font-weight: bold; color: #111827; margin-bottom: 4px;">Website Project</div>
				<div style="font-size: 18px; color: #6b7280;">Questionnaire</div>
			</div>
		</div>

		<!-- Client Info Box -->
		<div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 32px; border-left: 4px solid ${accentColor};">
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Client</div>
					<div style="font-size: 16px; font-weight: 600; color: #111827;">${questionnaire.clientBusinessName || "Not provided"}</div>
				</div>
				<div style="text-align: right;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Status</div>
					<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusStyle.bg}; color: ${statusStyle.text}; text-transform: capitalize;">
						${questionnaire.status.replace("_", " ")}
					</span>
				</div>
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Email</div>
					<div style="font-size: 14px; color: #374151;">${questionnaire.clientEmail || "Not provided"}</div>
				</div>
				<div style="text-align: right;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Submitted</div>
					<div style="font-size: 14px; color: #374151;">${formatDate(questionnaire.completedAt)}</div>
				</div>
			</div>
		</div>

		<!-- Sections -->
		${renderSection(1, "Personal Information", section1, accentColor)}
		${renderSection(2, "Company Details", section2, accentColor)}
		${renderSection(3, "Information to be Displayed", section3, accentColor)}
		${renderSection(4, "Domain & Technical", section4, accentColor)}
		${renderSection(5, "About Your Business", section5, accentColor)}
		${renderSection(6, "Website Content", section6, accentColor)}
		${renderSection(7, "Website Design", section7, accentColor)}
		${renderSection(8, "Final Details", section8, accentColor)}

		<!-- Footer -->
		<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
			<div>Generated on ${formatDate(new Date())} by ${agency.name}</div>
			${profile?.websiteUrl ? `<div style="margin-top: 4px;">${profile.websiteUrl}</div>` : ""}
		</div>
	</div>
</body>
</html>`;
}
