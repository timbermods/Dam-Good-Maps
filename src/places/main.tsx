import { render } from "preact";
import { Gallery } from "./Gallery";
import "../styles/app.css";
import "../styles/places.css";

render(<Gallery />, document.getElementById("app")!);
