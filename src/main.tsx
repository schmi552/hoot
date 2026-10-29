import { createRoot } from "react-dom/client";
import "../docs/design-system/tokens.css";
import "../docs/design-system/components.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
