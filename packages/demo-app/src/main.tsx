import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import { installGtCollector } from "./mutation/gtMarkers";

installGtCollector();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Ward failed to mount: #root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
