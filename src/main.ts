import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/app.css";
import "./styles/markdown/base.css";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
