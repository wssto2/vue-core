import { createFormatting, installFormatting } from "@wssto2/vue-core/format";
import { installIcons } from "@wssto2/vue-core/icon";
import { coreMessages } from "@wssto2/vue-core/i18n";
import { installBottomDock, installPageChrome } from "@wssto2/vue-core/page";
import { installPlatform } from "@wssto2/vue-core/platform";
import { createApp } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./app.css";
import { shellIcons } from "./app/icons";
import { appIcons } from "./icons";
import { platform } from "./platform";

const app = createApp(App);
installPlatform(app, platform);

// What the library's components need from their app: the texts, the routes their links go to, the app's
// icons, the page chrome (the phone nav bar would read it) and the bottom dock.
const i18n = createI18n({ legacy: false, locale: new URLSearchParams(location.search).get("locale") ?? "en", fallbackLocale: "en", messages: coreMessages });
app.use(i18n);
installFormatting(app, createFormatting({ locale: () => i18n.global.locale.value }));
app.use(createRouter({ history: createWebHashHistory(), routes: [{ path: "/:rest(.*)*", component: { render: () => null } }] }));
installIcons(app, appIcons, shellIcons);
installPageChrome(app);
installBottomDock(app);

app.mount("#app");
