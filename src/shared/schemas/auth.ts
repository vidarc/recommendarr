import { z } from "zod";

const MIN_USERNAME_LENGTH = 1;
const MIN_PASSWORD_LENGTH = 8;

const credentialsSchema = z.object({
	username: z.string().min(MIN_USERNAME_LENGTH),
	password: z.string().min(MIN_PASSWORD_LENGTH),
});

const userResponseSchema = z.object({
	id: z.string(),
	username: z.string(),
	isAdmin: z.boolean(),
});

const setupStatusSchema = z.object({
	needsSetup: z.boolean(),
});

type Credentials = z.infer<typeof credentialsSchema>;
type UserResponse = z.infer<typeof userResponseSchema>;
type SetupStatus = z.infer<typeof setupStatusSchema>;

export { credentialsSchema, setupStatusSchema, userResponseSchema };
export type { Credentials, SetupStatus, UserResponse };
