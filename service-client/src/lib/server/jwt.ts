import * as jose from "jose";
import { readFileSync, existsSync } from "fs";
import { logger } from "./logger";
import path from "path";

// Determine public key path - Docker uses /public.pem, local dev uses relative path
function getPublicKeyPath(): string {
	// Check Docker path first
	if (existsSync("/public.pem")) {
		return "/public.pem";
	}
	// Fall back to relative path for local development
	return path.resolve(process.cwd(), "public.pem");
}

// Verify a JWT token using EdDSA
export async function verifyJWT<T>(token: string): Promise<T | undefined> {
	// Empty token is not an error, just means user isn't authenticated
	if (!token) {
		return undefined;
	}

	try {
		const publicKey = readFileSync(getPublicKeyPath(), "utf-8");
		const p = await jose.importSPKI(publicKey, "EdDSA");
		const { payload } = await jose.jwtVerify<T>(token, p);
		return payload;
	} catch (e) {
		// Token expiration is normal (triggers refresh), only log actual errors
		if (e instanceof jose.errors.JWTExpired) {
			logger.debug("JWT token expired - refresh will be attempted");
		} else {
			logger.error("Error verifying JWT", e);
		}
		return undefined;
	}
}
