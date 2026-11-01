import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppStateProvider } from "./lib/store";
import "./index.css";
import "./theme-light.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </React.StrictMode>,
);

// Register the service worker for PWA install + offline shell.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Honest failure: PWA install may be unavailable, the app still works.
      console.warn("HALOCK: service worker registration failed:", err);
    });
  });
}
