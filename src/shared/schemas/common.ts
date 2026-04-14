import * as z from "zod/mini";

const errorResponseSchema = z.object({
	error: z.string(),
});

const successResponseSchema = z.object({
	success: z.boolean(),
});

type ErrorResponse = z.infer<typeof errorResponseSchema>;
type SuccessResponse = z.infer<typeof successResponseSchema>;

export { errorResponseSchema, successResponseSchema };
export type { ErrorResponse, SuccessResponse };
