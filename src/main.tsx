import { render } from "preact";
import { App } from "./ui/App";
import "./styles/app.css";
import "./styles/editor.css";

render(<App />, document.getElementById("app")!);
