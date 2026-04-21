import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { decrypt, encrypt, resetKeyCache } from "../services/encryption.ts";

describe("encryption service", () => {
	const HEX_KEY_LENGTH = 64;
	const testKey = "a".repeat(HEX_KEY_LENGTH); // Valid 64-char hex string

	afterEach(() => {
		vi.unstubAllEnvs();
		resetKeyCache();
	});

	it("encrypt returns a string different from input", () => {
		vi.stubEnv("ENCRYPTION_KEY", testKey);

		const encrypted = encrypt("hello world");
		expect(encrypted).not.toBe("hello world");
	});

	it("decrypt reverses encrypt", () => {
		vi.stubEnv("ENCRYPTION_KEY", testKey);

		const encrypted = encrypt("secret token");
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe("secret token");
	});

	it("encrypt throws without ENCRYPTION_KEY", () => {
		vi.stubEnv("ENCRYPTION_KEY", "");
		expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
	});

	it("encrypt throws with invalid key length", () => {
		vi.stubEnv("ENCRYPTION_KEY", "tooshort");

		expect(() => encrypt("test")).toThrow(/64-character hex string/);
	});
});
