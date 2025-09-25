import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { apiEndpoints } from "$lib/config/api";

// Client-side logging - cannot use server logger
const logger = {
	debug: (msg: string, data?: any) => console.debug(msg, data),
	error: (msg: string, error?: any) => console.error(msg, error),
	info: (msg: string, data?: any) => console.info(msg, data),
	warn: (msg: string, data?: any) => console.warn(msg, data)
};

// Client-side HTTP client using fetch
const api = {
	async post<T>(url: string, data: any): Promise<{success: boolean, data?: T, message?: string}> {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			return await response.json();
		} catch (error) {
			return { success: false, message: 'Network error' };
		}
	},
	async get<T>(url: string): Promise<{success: boolean, data?: T, message?: string}> {
		try {
			const response = await fetch(url);
			return await response.json();
		} catch (error) {
			return { success: false, message: 'Network error' };
		}
	}
};

// Client-side JWT verification - simplified (should validate server-side in production)
const verifyJWT = async (token: string): Promise<any> => {
	try {
		// In a real implementation, this should call a server endpoint for validation
		// For now, just decode the payload (this is NOT secure validation)
		const parts = token.split('.');
		if (parts.length !== 3) throw new Error('Invalid token format');
		const payload = JSON.parse(atob(parts[1]));
		return payload;
	} catch (error) {
		throw new Error('Invalid token');
	}
};

// Client-side Safe type (simplified version)
type Safe<T> = {
	success: boolean;
	data?: T;
	message?: string;
};

export interface AuthTokens {
	access_token: string;
	refresh_token: string;
}

export interface AuthUser {
	id: string;
	email: string;
	role: string;
	name?: string;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface RegisterData extends LoginCredentials {
	name: string;
	confirmPassword: string;
}

export interface AuthResponse {
	user: AuthUser;
	tokens: AuthTokens;
}

export class AuthService {
	private readonly ACCESS_TOKEN_KEY = "access_token";
	private readonly REFRESH_TOKEN_KEY = "refresh_token";
	private readonly USER_KEY = "user";
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || apiEndpoints.auth;
	}

	/**
	 * Get stored access token from localStorage
	 */
	getAccessToken(): string | null {
		if (!browser) return null;
		return localStorage.getItem(this.ACCESS_TOKEN_KEY);
	}

	/**
	 * Get stored refresh token from localStorage
	 */
	getRefreshToken(): string | null {
		if (!browser) return null;
		return localStorage.getItem(this.REFRESH_TOKEN_KEY);
	}

	/**
	 * Get stored user data
	 */
	getUser(): AuthUser | null {
		if (!browser) return null;
		const userData = localStorage.getItem(this.USER_KEY);
		if (!userData) return null;

		try {
			return JSON.parse(userData) as AuthUser;
		} catch (error) {
			logger.error("Failed to parse stored user data", error);
			return null;
		}
	}

	/**
	 * Store authentication tokens and user data
	 */
	private storeAuth(tokens: AuthTokens, user: AuthUser): void {
		if (!browser) return;

		localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.access_token);
		localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refresh_token);
		localStorage.setItem(this.USER_KEY, JSON.stringify(user));

		logger.debug("Authentication data stored", { userId: user.id });
	}

	/**
	 * Clear stored authentication data
	 */
	private clearAuth(): void {
		if (!browser) return;

		localStorage.removeItem(this.ACCESS_TOKEN_KEY);
		localStorage.removeItem(this.REFRESH_TOKEN_KEY);
		localStorage.removeItem(this.USER_KEY);

		logger.debug("Authentication data cleared");
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		const token = this.getAccessToken();
		const user = this.getUser();
		return !!(token && user);
	}

	/**
	 * Verify if current token is valid
	 */
	async verifyToken(): Promise<boolean> {
		const token = this.getAccessToken();
		if (!token) return false;

		try {
			const payload = await verifyJWT(token);
			return !!payload;
		} catch (error) {
			logger.error("Token verification failed", error);
			return false;
		}
	}

	/**
	 * Login with email and password
	 */
	async login(credentials: LoginCredentials): Promise<Safe<AuthResponse>> {
		try {
			logger.debug("Attempting login", { email: credentials.email });

			const formData = new FormData();
			formData.append("email", credentials.email);
			formData.append("password", credentials.password);

			const response = await api<AuthResponse>(`${this.baseUrl}/auth/login`, {
				method: "POST",
				form: formData,
			});

			if (!response.success) {
				return response;
			}

			// Store authentication data
			this.storeAuth(response.data.tokens, response.data.user);

			logger.debug("Login successful", { userId: response.data.user.id });

			return {
				success: true,
				data: response.data,
				message: "Login successful",
			};
		} catch (error) {
			logger.error("Login failed", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Login failed",
				code: 500,
			};
		}
	}

	/**
	 * Register new user account
	 */
	async register(data: RegisterData): Promise<Safe<AuthResponse>> {
		try {
			if (data.password !== data.confirmPassword) {
				return {
					success: false,
					message: "Passwords do not match",
					code: 400,
				};
			}

			logger.debug("Attempting registration", { email: data.email, name: data.name });

			const formData = new FormData();
			formData.append("email", data.email);
			formData.append("password", data.password);
			formData.append("name", data.name);

			const response = await api<AuthResponse>(`${this.baseUrl}/auth/register`, {
				method: "POST",
				form: formData,
			});

			if (!response.success) {
				return response;
			}

			// Store authentication data
			this.storeAuth(response.data.tokens, response.data.user);

			logger.debug("Registration successful", { userId: response.data.user.id });

			return {
				success: true,
				data: response.data,
				message: "Registration successful",
			};
		} catch (error) {
			logger.error("Registration failed", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Registration failed",
				code: 500,
			};
		}
	}

	/**
	 * Refresh authentication tokens
	 */
	async refreshTokens(): Promise<Safe<AuthTokens>> {
		try {
			const refreshToken = this.getRefreshToken();
			if (!refreshToken) {
				return {
					success: false,
					message: "No refresh token available",
					code: 401,
				};
			}

			logger.debug("Attempting token refresh");

			const response = await api<AuthResponse>(`${this.baseUrl}/auth/refresh`, {
				method: "POST",
				token: refreshToken,
			});

			if (!response.success) {
				// If refresh fails, clear stored auth and redirect to login
				this.clearAuth();
				return response;
			}

			// Update stored tokens
			this.storeAuth(response.data.tokens, response.data.user);

			logger.debug("Token refresh successful");

			return {
				success: true,
				data: response.data.tokens,
				message: "Tokens refreshed successfully",
			};
		} catch (error) {
			logger.error("Token refresh failed", error);
			this.clearAuth();
			return {
				success: false,
				message: error instanceof Error ? error.message : "Token refresh failed",
				code: 500,
			};
		}
	}

	/**
	 * Logout user and clear stored data
	 */
	async logout(): Promise<Safe<void>> {
		try {
			const token = this.getAccessToken();

			if (token) {
				// Attempt to notify server of logout
				await api(`${this.baseUrl}/auth/logout`, {
					method: "POST",
					token,
				});
			}

			// Clear local storage regardless of server response
			this.clearAuth();

			logger.debug("Logout completed");

			return {
				success: true,
				data: undefined,
				message: "Logout successful",
			};
		} catch (error) {
			// Even if server logout fails, clear local data
			this.clearAuth();
			logger.error("Logout error (local data cleared)", error);

			return {
				success: true,
				data: undefined,
				message: "Logout completed",
			};
		}
	}

	/**
	 * Get current user profile
	 */
	async getCurrentUser(): Promise<Safe<AuthUser>> {
		try {
			const token = this.getAccessToken();
			if (!token) {
				return {
					success: false,
					message: "No access token available",
					code: 401,
				};
			}

			const response = await api<AuthUser>(`${this.baseUrl}/auth/me`, {
				method: "GET",
				token,
			});

			if (!response.success) {
				return response;
			}

			// Update stored user data
			if (browser) {
				localStorage.setItem(this.USER_KEY, JSON.stringify(response.data));
			}

			return {
				success: true,
				data: response.data,
				message: "User profile retrieved successfully",
			};
		} catch (error) {
			logger.error("Failed to get current user", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to get user profile",
				code: 500,
			};
		}
	}

	/**
	 * Update user profile
	 */
	async updateProfile(userData: Partial<AuthUser>): Promise<Safe<AuthUser>> {
		try {
			const token = this.getAccessToken();
			if (!token) {
				return {
					success: false,
					message: "No access token available",
					code: 401,
				};
			}

			const formData = new FormData();
			if (userData.name) formData.append("name", userData.name);
			if (userData.email) formData.append("email", userData.email);

			const response = await api<AuthUser>(`${this.baseUrl}/auth/profile`, {
				method: "PUT",
				token,
				form: formData,
			});

			if (!response.success) {
				return response;
			}

			// Update stored user data
			if (browser) {
				localStorage.setItem(this.USER_KEY, JSON.stringify(response.data));
			}

			logger.debug("Profile updated successfully", { userId: response.data.id });

			return {
				success: true,
				data: response.data,
				message: "Profile updated successfully",
			};
		} catch (error) {
			logger.error("Failed to update profile", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to update profile",
				code: 500,
			};
		}
	}

	/**
	 * Check if user has required role
	 */
	hasRole(requiredRole: string): boolean {
		const user = this.getUser();
		return user?.role === requiredRole || user?.role === "admin";
	}

	/**
	 * Require authentication - redirect to login if not authenticated
	 */
	async requireAuth(): Promise<boolean> {
		if (!browser) return false;

		if (!this.isAuthenticated()) {
			await goto("/login");
			return false;
		}

		// Check if token is still valid
		const isValid = await this.verifyToken();
		if (!isValid) {
			// Try to refresh token
			const refreshResult = await this.refreshTokens();
			if (!refreshResult.success) {
				await goto("/login");
				return false;
			}
		}

		return true;
	}

	/**
	 * Get authorization header for API requests
	 */
	getAuthHeader(): string | null {
		const token = this.getAccessToken();
		return token ? `Bearer ${token}` : null;
	}
}

// Default auth service instance
export const authService = new AuthService();
