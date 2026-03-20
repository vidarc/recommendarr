import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const execAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

const hashPassword = async (password: string): Promise<string> => {
	const salt = randomBytes(SALT_LENGTH);
	const hash = (await execAsync(password, salt, KEY_LENGTH)) as Buffer;
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
};

const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) {
		return false;
	}

	const salt = Buffer.from(saltHex, "hex");
	const storedHash = Buffer.from(hashHex, "hex");
	const hash = (await execAsync(password, salt, KEY_LENGTH)) as Buffer;

	return timingSafeEqual(hash, storedHash);
};

export { hashPassword, verifyPassword };
