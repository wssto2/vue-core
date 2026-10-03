import type { SignInEvent } from "../../modules/identity/entities";
import type { Tone } from "../../state";

/** How a sign-in event reads: the badge's tone, and whether somebody else did it (the actor is then named). */
const EVENTS: Record<SignInEvent, { tone: Tone; byOther: boolean }> = {
  signed_in: { tone: "positive", byOther: false },
  wrong_password: { tone: "critical", byOther: false },
  locked_out: { tone: "critical", byOther: false },
  refused_inactive: { tone: "critical", byOther: false },
  signed_in_as: { tone: "warning", byOther: true },
  unlocked: { tone: "neutral", byOther: true },
  signed_out_everywhere: { tone: "neutral", byOther: true },
  session_revoked: { tone: "neutral", byOther: true },
};

/** The style of an event; an event this version does not know is neutral and reads as a generic one, never as its key. */
export function signInEventStyle(event: string): { tone: Tone; byOther: boolean; known: boolean } {
  const style = EVENTS[event as SignInEvent];
  return style ? { ...style, known: true } : { tone: "neutral", byOther: false, known: false };
}

/** The i18n key of an event's words: with the actor's name when somebody else did it and the name is known. */
export function signInEventKey(event: string, actorName: string | null): string {
  const style = signInEventStyle(event);
  if (!style.known) return "core.account.signins.events.unknown";
  return style.byOther && actorName ? `core.account.signins.events_by.${event}` : `core.account.signins.events.${event}`;
}
