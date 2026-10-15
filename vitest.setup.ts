import { configure } from "@testing-library/vue";

// The first visit to a lazily imported route has Vite compile that page on demand; in a full parallel run this can
// take longer than the library's default of 1 s, so a test waiting for the navigation failed at random.
configure({ asyncUtilTimeout: 5_000 });
