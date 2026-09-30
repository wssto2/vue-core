import { installPlatform } from "@wssto2/vue-core/platform";
import { createApp } from "vue";
import App from "./App.vue";
import "./app.css";
import { platform } from "./platform";

const app = createApp(App);
installPlatform(app, platform);
app.mount("#app");
