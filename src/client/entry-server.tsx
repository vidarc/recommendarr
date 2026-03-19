import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { App } from "./App.tsx";
import { store } from "./store.ts";

export const render = (): string =>
	renderToString(
		<StrictMode>
			<Provider store={store}>
				<App />
			</Provider>
		</StrictMode>,
	);
