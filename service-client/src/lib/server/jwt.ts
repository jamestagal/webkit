import * as jose from "jose";
import { readFileSync } from "fs";
import { logger } from "./logger";
import path from "path";

// Verify a JWT token using EdDSA
export async function verifyJWT<T>(token: string): Promise<T | undefined> {
	try {
		// Load public key
		const publicKey = readFileSync(path.resolve("/public.pem"), "utf-8");
		const p = await jose.importSPKI(publicKey, "EdDSA");

		const { payload } = await jose.jwtVerify<T>(token, p);
		return payload;
	} catch (e) {
		logger.error("Error verifying JWT", e);
		return undefined;
	}
}
