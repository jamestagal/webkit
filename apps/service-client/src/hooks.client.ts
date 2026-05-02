import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

const dsn = env["PUBLIC_SENTRY_DSN"];
if (dsn) {
	Sentry.init({
		dsn,
		environment: "browser",
		tracesSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 0,
		integrations: [Sentry.browserTracingIntegration()],
		beforeSend(event, _hint) {
			const errorMessage = event.exception?.values?.[0]?.value;
			const requestUrl = event.request?.url;

			if (errorMessage?.includes('Failed to fetch') &&
			    (requestUrl?.includes('__data.json') || requestUrl?.includes('/api/'))) {
				return null;
			}

			return event;
		},
	});
}

export const handleError = Sentry.handleErrorWithSentry();
