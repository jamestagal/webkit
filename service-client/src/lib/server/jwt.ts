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
	try {
		// Load public key
		const publicKey = readFileSync(getPublicKeyPath(), "utf-8");
		const p = await jose.importSPKI(publicKey, "EdDSA");

		const { payload } = await jose.jwtVerify<T>(token, p);
		return payload;
	} catch (e) {
		logger.error("Error verifying JWT", e);
		return undefined;
	}
}
