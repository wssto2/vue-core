// Offender (api-error): ApiError from another module than the client.
import { isApiError } from "@/client/errors";

export const failed = (error: unknown) => isApiError(error);
