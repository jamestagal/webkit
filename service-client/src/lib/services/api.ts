import { consultationApiService, type ConsultationApiService } from "./consultation.service";
import { authService, type AuthService } from "./auth";

/**
 * Centralized API client with automatic JWT token handling
 */
export class ApiClient {
	private _auth: AuthService;
	private _consultation: ConsultationApiService;

	constructor() {
		this._auth = authService;
		this._consultation = consultationApiService;
	}

	get auth(): AuthService {
		return this._auth;
	}

	get consultation(): ConsultationApiService {
		return this._consultation;
	}
}

// Default API client instance
export const apiClient = new ApiClient();

// Export individual services for direct access
export { consultationApiService } from "./consultation.service";
export { authService } from "./auth";
