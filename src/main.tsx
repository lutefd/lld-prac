import { createRoot } from "react-dom/client";
import App from "./App";
import { PreferencesProvider } from "./preferences";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root was not found");
createRoot(rootElement).render(
  <PreferencesProvider>
    <App />
  </PreferencesProvider>,
);
