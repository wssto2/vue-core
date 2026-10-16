import type { Component } from "vue";
import DeactivateDialog from "./DeactivateDialog.vue";
import NewUserDialog from "./NewUserDialog.vue";
import { useUsersContext } from "./context";

/**
 * The New user and Deactivate dialogs the screens use: the application's (`usersFeature({ replace })`) or the library's. A
 * replaced list or record mounts these, so one replacement of a dialog serves every screen. Use them through a template ref
 * (`NewUserDialogHandle`, `DeactivateDialogHandle`).
 */
export function useUserDialogs(): { newUser: Component; deactivate: Component } {
  const { replace } = useUsersContext();
  return { newUser: replace.newUser ?? NewUserDialog, deactivate: replace.deactivate ?? DeactivateDialog };
}
