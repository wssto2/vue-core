// An application whose server projects more than go-core's default user (`UserProjector`) reads it itself.
import { identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap, type SessionUser } from "@wssto2/vue-core/platform";

interface Employee extends SessionUser {
  readonly name: string;
  readonly dealer: string;
}

const parseEmployee = (raw: unknown): Employee => {
  const { id, name, dealer } = raw as { id: number; name: string; dealer: string };
  return { id, name, dealer };
};

export const platform = createPlatform({ config: readBootstrap(), ...identityPlatform({ parseUser: parseEmployee }) });
