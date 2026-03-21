import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { decrypt, encrypt } from "../services/encryption.ts";

describe("encryption service", () => {
	const HEX_KEY_LENGTH = 64;
	const testKey = "a".repeat(HEX_KEY_LENGTH); // Valid 64-char hex string

	test("encrypt returns a string different from input", () => {
		process.env["ENCRYPTION_KEY"] = testKey;
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		const encrypted = encrypt("hello world");
		expect(encrypted).not.toBe("hello world");
	});

	test("decrypt reverses encrypt", () => {
		process.env["ENCRYPTION_KEY"] = testKey;
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		const encrypted = encrypt("secret token");
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe("secret token");
	});

	test("encrypt throws without ENCRYPTION_KEY", () => {
		delete process.env["ENCRYPTION_KEY"];
		expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
	});

	test("encrypt throws with invalid key length", () => {
		process.env["ENCRYPTION_KEY"] = "tooshort";
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		expect(() => encrypt("test")).toThrow();
	});
});
