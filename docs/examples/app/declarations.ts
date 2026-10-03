// What the application tells the types about itself: its permissions, the destinations of its
// backend's menu and its icons. Declaration merging, like vue-router's `RouteMeta`: a permission,
// destination or icon that is not declared here is a compile error where it is used.
import type { IconSet } from "@wssto2/vue-core/icon";

declare module "@wssto2/vue-core/platform" {
  interface PermissionRegistry {
    "tickets:view": true;
    "tickets:update": true;
    "accounts:view": true;
    // go-core's access module defines these in the catalogue, so a generated union has them (the roles screens name them).
    "iam.role:view": true;
    "iam.role:manage": true;
    "iam.role:delete": true;
    "iam.user:view": true;
    "iam.user:manage": true;
  }
}

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    tickets: true;
    accounts: true;
    "iam.roles": true;
  }
}

declare module "@wssto2/vue-core/icon" {
  interface IconRegistry {
    ticketLine: true;
  }
}

/** The SVG sources of the declared icons (here Remix Icon's "coupon"); a feature may bring its own set. */
export const appIcons = {
  ticketLine:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3C21.5523 3 22 3.44772 22 4V9.5C20.6193 9.5 19.5 10.6193 19.5 12C19.5 13.3807 20.6193 14.5 22 14.5V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V14.5C3.38071 14.5 4.5 13.3807 4.5 12C4.5 10.6193 3.38071 9.5 2 9.5V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V7.8C5.6 8.6 6.5 10.2 6.5 12C6.5 13.8 5.6 15.4 4 16.2V19H20V16.2C18.4 15.4 17.5 13.8 17.5 12C17.5 10.2 18.4 8.6 20 7.8V5Z"></path></svg>',
} satisfies IconSet;
