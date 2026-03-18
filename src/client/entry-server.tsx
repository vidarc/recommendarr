import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App.tsx";

export const render = (): string =>
	renderToString(
		<StrictMode>
			<App />
		</StrictMode>,
	);
