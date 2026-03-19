import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./App.tsx";
import { store } from "./store.ts";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element not found");
}

// oxlint-disable-next-line jest/require-hook
hydrateRoot(
	root,
	<StrictMode>
		<Provider store={store}>
			<App />
		</Provider>
	</StrictMode>,
);
