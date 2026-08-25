import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupFrontendLogging } from "./logger";
import "./styles.css";

setupFrontendLogging();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
