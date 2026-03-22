import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { IntegrationsTab } from "../IntegrationsTab.tsx";

const renderTab = () => {
	onTestFinished(cleanup);
	render(<IntegrationsTab />);
};

describe("IntegrationsTab", () => {
	test("renders the radarr/sonarr heading", () => {
		renderTab();

		expect(screen.getByText("Radarr / Sonarr")).toBeInTheDocument();
	});

	test("shows coming soon badge", () => {
		renderTab();

		expect(screen.getByText("Coming Soon")).toBeInTheDocument();
	});

	test("renders all fields as disabled", () => {
		renderTab();

		expect(screen.getByLabelText(/radarr url/i)).toBeDisabled();
		expect(screen.getByLabelText(/radarr api key/i)).toBeDisabled();
		expect(screen.getByLabelText(/sonarr url/i)).toBeDisabled();
		expect(screen.getByLabelText(/sonarr api key/i)).toBeDisabled();
	});

	test("renders placeholders for URLs", () => {
		renderTab();

		expect(screen.getByPlaceholderText("http://localhost:7878")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("http://localhost:8989")).toBeInTheDocument();
	});
});
