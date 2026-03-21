import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const HEX_KEY_LENGTH = 64;

const getKey = (): Buffer => {
	const keyHex = process.env["ENCRYPTION_KEY"];
	if (!keyHex) {
		throw new Error(
			"ENCRYPTION_KEY environment variable is required. " +
				"Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
		);
	}
	if (keyHex.length !== HEX_KEY_LENGTH) {
		throw new Error(`ENCRYPTION_KEY must be a ${HEX_KEY_LENGTH}-character hex string (32 bytes)`);
	}
	return Buffer.from(keyHex, "hex");
};

const encrypt = (plaintext: string): string => {
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Format: iv:authTag:ciphertext (all hex)
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (ciphertext: string): string => {
	const key = getKey();
	const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
	if (!ivHex || !authTagHex || !encryptedHex) {
		throw new Error("Invalid ciphertext format");
	}

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const encrypted = Buffer.from(encryptedHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

export { decrypt, encrypt, getKey };
