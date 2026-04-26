// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces
import type { User } from "./lib/types";
declare global {
	namespace App {
		// Usage-quota errors surface structured hints alongside the message so
		// the UI can render "Resets 1 May 2026" / "all 10 PDF exports" cleanly
		// without regex-parsing the human string on every page.
		interface Error {
			message: string;
			// Explicit `| undefined` lets callers pass these fields as `undefined`
			// under tsconfig's `exactOptionalPropertyTypes`, which otherwise rejects
			// optional properties with an explicit undefined value.
			limit?: number | undefined;
			feature?: string | undefined;
			resetDate?: string | undefined;
		}
		interface Locals {
			user: User;
			token: string;
			session: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
