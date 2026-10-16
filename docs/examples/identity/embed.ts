// A page inside a cross-origin iframe, where the browser blocks cookies: the host hands over a bearer token, which this tab keeps.
import { embedSession, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";

export const embed = embedSession(); // sessionStorage, keys `embed_access_token` and `embed_expires_at`

// The page that receives the token (the server's embed entry) keeps it: embed.start(token, expiresAt)

// Requests carry the token, the session is read with it and is not renewable; a refused token is forgotten, and so is it at sign-out.
export const platform = createPlatform({ config: readBootstrap(), credentials: "include", ...identityPlatform({ embed }) });
