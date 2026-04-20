import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	onTestFinished,
	it,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { usePlexAuth } from "../use-plex-auth.ts";

import type { ReactNode } from "react";

const internalServerError = 500;
const mockPinId = 42;
const mockAuthUrl = "https://app.plex.tv/auth#?clientID=test&code=abcd";
const FIRST_CALL = 0;
const FEATURES_ARG = 2;

const server = setupServer();

const wrapWithStore = (store: ReturnType<typeof createStore>) => {
	const Wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	);
	return Wrapper;
};

const renderPlexAuthHook = () => {
	const store = createStore();
	const dispatchSpy = vi.spyOn(store, "dispatch");
	onTestFinished(() => {
		store.dispatch(api.util.resetApiState());
	});
	const result = renderHook(() => usePlexAuth(), {
		wrapper: wrapWithStore(store),
	});
	return { ...result, store, dispatchSpy };
};

interface FakePopup {
	closed: boolean;
	close: ReturnType<typeof vi.fn>;
}

const makeFakePopup = (): FakePopup => ({
	closed: false,
	close: vi.fn<(this: FakePopup) => void>(function close(this: FakePopup) {
		this.closed = true;
	}),
});

const spyWindowOpen = (popup: FakePopup | undefined) => {
	const spy = vi.spyOn(globalThis, "open");
	onTestFinished(() => {
		spy.mockRestore();
	});
	// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
	spy.mockReturnValue(popup as unknown as Window);
	return spy;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

describe(usePlexAuth, () => {
	beforeAll(() => {
		server.listen();
	});

	beforeEach(() => {
		server.use(
			http.post("/api/plex/auth/start", () =>
				HttpResponse.json({ pinId: mockPinId, authUrl: mockAuthUrl }),
			),
		);
	});

	afterEach(() => {
		server.resetHandlers();
		cleanup();
	});

	afterAll(() => {
		server.close();
	});

	it("opens centered popup and polls until PIN is claimed", async () => {
		const fakePopup = makeFakePopup();
		const openSpy = spyWindowOpen(fakePopup);
		server.use(http.get("/api/plex/auth/check", () => HttpResponse.json({ claimed: true })));

		const { result, dispatchSpy } = renderPlexAuthHook();

		await act(async () => {
			await result.current.connect();
		});

		expect(openSpy).toHaveBeenCalledWith(mockAuthUrl, "plex-auth", expect.any(String));
		const features = openSpy.mock.calls[FIRST_CALL]?.[FEATURES_ARG] ?? "";
		expect(features).toContain("width=600");
		expect(features).toContain("height=600");
		expect(fakePopup.close).toHaveBeenCalledOnce();
		expect(result.current.polling).toBe(false);
		expect(result.current.error).toBe("");

		// Verify the claim path dispatched the PlexConnection invalidation.
		const invalidation = dispatchSpy.mock.calls.find(([action]) => {
			if (!isPlainRecord(action)) {
				return false;
			}
			const { payload } = action;
			return Array.isArray(payload) && payload.includes("PlexConnection");
		});
		expect(invalidation).toBeDefined();
	});

	it("surfaces a popup-blocked error without polling", async () => {
		spyWindowOpen(undefined);
		const checkCalls = vi.fn<() => HttpResponse<{ claimed: boolean }>>(() =>
			HttpResponse.json({ claimed: false }),
		);
		server.use(http.get("/api/plex/auth/check", checkCalls));

		const { result } = renderPlexAuthHook();

		await act(async () => {
			await result.current.connect();
		});

		expect(result.current.error).toMatch(/popup blocked/i);
		expect(result.current.polling).toBe(false);
		expect(checkCalls).not.toHaveBeenCalled();
	});

	it("surfaces a start-auth error without opening a popup", async () => {
		const openSpy = spyWindowOpen(undefined);
		server.use(
			http.post("/api/plex/auth/start", () =>
				HttpResponse.json({ error: "nope" }, { status: internalServerError }),
			),
		);

		const { result } = renderPlexAuthHook();

		await act(async () => {
			await result.current.connect();
		});

		expect(result.current.error).toBe("Failed to start Plex authentication");
		expect(openSpy).not.toHaveBeenCalled();
		expect(result.current.polling).toBe(false);
	});

	it("closes popup on unmount while polling is still pending", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		onTestFinished(() => {
			vi.useRealTimers();
		});

		const fakePopup = makeFakePopup();
		spyWindowOpen(fakePopup);
		server.use(http.get("/api/plex/auth/check", () => HttpResponse.json({ claimed: false })));

		const { result, unmount } = renderPlexAuthHook();

		await act(async () => {
			await result.current.connect();
		});

		// A setTimeout has been scheduled for the next poll iteration.
		await waitFor(() => {
			expect(result.current.polling).toBe(true);
		});

		unmount();

		expect(fakePopup.close).toHaveBeenCalledOnce();
	});
});
