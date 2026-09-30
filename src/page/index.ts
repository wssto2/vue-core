export { default as AdaptivePageShell } from "./AdaptivePageShell.vue";
export { default as BottomDock } from "./BottomDock.vue";
export { bottomDockKey, installBottomDock, useBottomDockTarget } from "./bottomDock";
export { default as BottomDockPortal } from "./BottomDockPortal.vue";
export { default as BottomTabBar, type BottomTabBarItem } from "./BottomTabBar.vue";
export { default as PageActions } from "./PageActions.vue";
export { default as PageToolbar } from "./PageToolbar.vue";
export { default as RecordHeader } from "./RecordHeader.vue";
export { default as ResourceHeader } from "./ResourceHeader.vue";
export {
  createPageChrome,
  installPageChrome,
  usePageChrome,
  usePageChromeContext,
  pageChromeKey,
  type FocusMemory,
  type PageChrome,
  type PageChromeOptions,
  type PageChromeOwner,
  type PageChromeRegistration,
} from "./chrome";
export { pageSectionBackKey, usePageSectionBack } from "./sectionBack";
export { provideSectionIndex, sectionId, useSectionAnchor, useSectionIndex } from "./sectionIndex";
export type { IndexedSection, SectionIndex } from "./sectionIndex";
export { default as SectionNavigator } from "./SectionNavigator.vue";
export { default as SectionJumper } from "./SectionJumper.vue";
export { default as SectionList } from "./SectionList.vue";
export { default as SectionPanel } from "./SectionPanel.vue";
export { useLargeTitle } from "./useLargeTitle";
export type { PageAction, PageBack, PagePathItem, PageSectionBack, QuickAction, SectionFormState } from "./types";
