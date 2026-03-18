import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element not found");
}

// oxlint-disable-next-line jest/require-hook
hydrateRoot(
	root,
	<StrictMode>
		<App />
	</StrictMode>,
);
