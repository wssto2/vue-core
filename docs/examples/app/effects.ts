import type { SessionEffect } from "@wssto2/vue-core/app";

async function removePushSubscription(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await (await registration.pushManager.getSubscription())?.unsubscribe();
}

// Background behavior is an effect: started when someone signs in, stopped (its returned function runs) when the
// session ends or changes. This one asks the session to run a cleanup while the user is still signed in, so a signed-out
// device stops receiving the user's notifications. `onBeforeSignOut` returns the function that removes the hook.
export const pushCleanup: SessionEffect = {
  id: "push.cleanup",
  scope: "session",
  start: ({ platform }) => platform.session.onBeforeSignOut(removePushSubscription),
};
