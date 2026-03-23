import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

const hashPassword = async (password: string): Promise<string> => {
	const salt = randomBytes(SALT_LENGTH);
	const result = await scryptAsync(password, salt, KEY_LENGTH);
	if (!Buffer.isBuffer(result)) {
		throw new Error("scrypt did not return a Buffer");
	}
	return `${salt.toString("hex")}:${result.toString("hex")}`;
};

const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) {
		return false;
	}

	const salt = Buffer.from(saltHex, "hex");
	const storedHash = Buffer.from(hashHex, "hex");
	const result = await scryptAsync(password, salt, KEY_LENGTH);
	if (!Buffer.isBuffer(result)) {
		throw new Error("scrypt did not return a Buffer");
	}

	return timingSafeEqual(result, storedHash);
};

export { hashPassword, verifyPassword };
