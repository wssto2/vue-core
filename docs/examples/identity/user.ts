// An application whose server projects more than go-core's default user (`UserProjector`) reads it itself; the `login` stays, the prompt for an expired session shows it.
import { identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap, type SessionUser } from "@wssto2/vue-core/platform";

interface Employee extends SessionUser {
  readonly login: string;
  readonly name: string;
  readonly dealer: string;
}

const parseEmployee = (raw: unknown): Employee => {
  const { id, login, name, dealer } = raw as { id: number; login: string; name: string; dealer: string };
  return { id, login, name, dealer };
};

export const platform = createPlatform({ config: readBootstrap(), ...identityPlatform({ parseUser: parseEmployee }) });
