import React from "react";
import { createRoot } from "react-dom/client";
import App from "./WorkspaceApp.jsx";
import "./styles.css";
import "./presentations/presentations.css";

createRoot(document.getElementById("root")).render(<App />);
