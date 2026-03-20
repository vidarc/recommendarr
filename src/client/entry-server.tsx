import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { Router } from "wouter";

import { App } from "./App.tsx";
import { createStore } from "./store.ts";

export const render = (url: string): string => {
	const app = (
		<Provider store={createStore()}>
			<App />
		</Provider>
	);

	return renderToString(<Router ssrPath={url}>{app}</Router>);
};
