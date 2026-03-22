import { useCallback, useEffect, useRef, useState } from "react";

import { useLazyCheckPlexAuthQuery, useStartPlexAuthMutation } from "../api.ts";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;
const POLL_INCREMENT = 1;

export const usePlexAuth = () => {
	const [startAuth, { isLoading: isStarting }] = useStartPlexAuthMutation();
	const [triggerCheck] = useLazyCheckPlexAuthQuery();
	const [polling, setPolling] = useState(false);
	const [error, setError] = useState("");
	const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(
		() => () => {
			if (pollRef.current) {
				clearTimeout(pollRef.current);
			}
		},
		[],
	);

	const connect = useCallback(async () => {
		setError("");
		const result = await startAuth();
		if ("error" in result) {
			setError("Failed to start Plex authentication");
			return;
		}

		const { pinId, authUrl } = result.data;
		window.open(authUrl, "_blank");
		setPolling(true);

		let polls = 0;
		const poll = async () => {
			if (polls >= MAX_POLLS) {
				setPolling(false);
				setError("Authentication timed out. Please try again.");
				return;
			}
			polls += POLL_INCREMENT;
			const check = await triggerCheck(pinId);
			if (check.data?.claimed) {
				setPolling(false);
				return;
			}
			pollRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
		};

		await poll();
	}, [startAuth, triggerCheck]);

	return { connect, isStarting, polling, error };
};
