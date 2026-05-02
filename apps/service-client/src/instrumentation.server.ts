import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

const dsn = env["PUBLIC_SENTRY_DSN"];
if (dsn) {
	Sentry.init({
		dsn,
		environment: env["PUBLIC_APP_DOMAIN"] === "app.webkit.au" ? "production" : "development",
		tracesSampleRate: 0.2,
		profilesSampleRate: 0,
		beforeSend(event) {
			const status = event.contexts?.response?.status_code;
			if (status === 401 || status === 403) return null;
			return event;
		},
	});
}
