import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";

import { api } from "../api.ts";
import { useLazyCheckPlexAuthQuery, useStartPlexAuthMutation } from "../features/plex/api.ts";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;
const POLL_INCREMENT = 1;
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;
const HALF = 2;

const openPlexPopup = (authUrl: string): Window | undefined => {
	const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / HALF;
	const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / HALF;
	const features = [
		`width=${String(POPUP_WIDTH)}`,
		`height=${String(POPUP_HEIGHT)}`,
		`left=${String(left)}`,
		`top=${String(top)}`,
		"resizable=yes",
		"scrollbars=yes",
		"status=no",
		"toolbar=no",
		"menubar=no",
		"location=no",
	].join(",");
	return window.open(authUrl, "plex-auth", features) ?? undefined;
};

export const usePlexAuth = () => {
	const dispatch = useDispatch();
	const [startAuth, { isLoading: isStarting }] = useStartPlexAuthMutation();
	const [triggerCheck] = useLazyCheckPlexAuthQuery();
	const [polling, setPolling] = useState(false);
	const [error, setError] = useState("");
	const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const cancelledRef = useRef(false);
	const popupRef = useRef<Window | undefined>(undefined);

	const closePopup = useCallback(() => {
		const popup = popupRef.current;
		popupRef.current = undefined;
		if (!popup) {
			return;
		}
		try {
			popup.close();
		} catch {
			// Cross-origin or severed reference — nothing we can do
		}
	}, []);

	useEffect(
		() => () => {
			cancelledRef.current = true;
			if (pollRef.current) {
				clearTimeout(pollRef.current);
			}
			closePopup();
		},
		[closePopup],
	);

	const connect = useCallback(async () => {
		setError("");
		cancelledRef.current = false;
		const result = await startAuth();
		if ("error" in result) {
			setError("Failed to start Plex authentication");
			return;
		}

		const { pinId, authUrl } = result.data;
		popupRef.current = openPlexPopup(authUrl);
		if (!popupRef.current) {
			setError("Popup blocked. Please allow popups for this site and try again.");
			return;
		}
		setPolling(true);

		let polls = 0;
		const poll = async () => {
			if (cancelledRef.current) {
				return;
			}
			if (polls >= MAX_POLLS) {
				setPolling(false);
				setError("Authentication timed out. Please try again.");
				closePopup();
				return;
			}
			polls += POLL_INCREMENT;
			const check = await triggerCheck(pinId);
			if (cancelledRef.current) {
				return;
			}
			if (check.data?.claimed) {
				setPolling(false);
				closePopup();
				dispatch(api.util.invalidateTags(["PlexConnection"]));
				return;
			}
			pollRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
		};

		await poll();
	}, [startAuth, triggerCheck, closePopup, dispatch]);

	return { connect, isStarting, polling, error };
};
