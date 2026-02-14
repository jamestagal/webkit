import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.init({
	dsn: env["PUBLIC_SENTRY_DSN"],
	environment: "browser",
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,
	integrations: [Sentry.browserTracingIntegration()],
});

export const handleError = Sentry.handleErrorWithSentry();
