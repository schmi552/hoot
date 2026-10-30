import { createRoot } from "react-dom/client";
import "../docs/design-system/tokens.css";
import "../docs/design-system/components.css";
import { App } from "./App";
import { Popup } from "./Popup";
import { followTheme } from "./theme";

followTheme();
createRoot(document.getElementById("root")!).render(location.hash === "#popup" ? <Popup /> : <App />);
