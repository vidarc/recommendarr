import { css } from "@linaria/atomic";
import { useCallback, useMemo } from "react";

import {
	useDisconnectPlexMutation,
	useGetPlexServersQuery,
	useSelectPlexServerMutation,
} from "../../api.ts";
import { usePlexAuth } from "../../hooks/use-plex-auth.ts";
import { colors, spacing } from "../../theme.ts";
import {
	buttonRow,
	dangerButton,
	errorText,
	fieldGroup,
	labelStyle,
	primaryButton,
	sectionCard,
	sectionTitle,
	selectStyle,
	statusText,
} from "./settings-styles.ts";

import type { PlexServer } from "../../api.ts";

const NO_SERVERS = 0;

const connectedRow = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${spacing.md};
`;

const connectedInfo = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
`;

const statusDot = css`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${colors.green};
	flex-shrink: 0;
`;

const connectedLabel = css`
	color: ${colors.text};
	font-weight: 500;
`;

/* ── Sub-components ────────────────────────────────────────── */

const ServerStatus = ({ serverName }: { serverName: string }) => (
	<div className={connectedInfo}>
		<span className={statusDot} />
		<span className={connectedLabel}>{serverName}</span>
	</div>
);

interface ServerSelectProps {
	servers: PlexServer[];
	onSelect: (server: PlexServer) => void;
	isLoading: boolean;
}

const ServerSelect = ({ servers, onSelect, isLoading }: ServerSelectProps) => {
	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			const server = servers.find((item) => item.clientIdentifier === event.target.value);
			if (server) {
				onSelect(server);
			}
		},
		[servers, onSelect],
	);

	return (
		<div className={fieldGroup}>
			<label htmlFor="plex-server" className={labelStyle}>
				Select Server
			</label>
			<select
				id="plex-server"
				className={selectStyle}
				onChange={handleChange}
				disabled={isLoading}
				defaultValue=""
			>
				<option value="" disabled>
					Choose a server...
				</option>
				{servers.map((server) => (
					<option key={server.clientIdentifier} value={server.clientIdentifier}>
						{server.name}
					</option>
				))}
			</select>
		</div>
	);
};

const PlexNotConnected = () => {
	const { connect, isStarting, polling, error } = usePlexAuth();

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>Plex Connection</h3>
			<p className={statusText}>Connect your Plex account to get personalized recommendations.</p>
			<div className={buttonRow}>
				<button
					type="button"
					className={primaryButton}
					onClick={connect}
					disabled={isStarting || polling}
				>
					{polling ? "Waiting for authentication..." : "Connect Plex"}
				</button>
			</div>
			{error && <p className={errorText}>{error}</p>}
		</div>
	);
};

interface PlexConnectedProps {
	serverName: string;
	onDisconnect: () => void;
	isDisconnecting: boolean;
}

const PlexConnectedCard = ({ serverName, onDisconnect, isDisconnecting }: PlexConnectedProps) => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>Plex Connection</h3>
		<div className={connectedRow}>
			<ServerStatus serverName={serverName} />
			<button
				type="button"
				className={dangerButton}
				onClick={onDisconnect}
				disabled={isDisconnecting}
			>
				{isDisconnecting ? "Disconnecting..." : "Disconnect"}
			</button>
		</div>
	</div>
);

const PlexServerSelection = () => {
	const { data, isLoading } = useGetPlexServersQuery();
	const [selectServer, { isLoading: isSelecting }] = useSelectPlexServerMutation();

	const handleSelect = useCallback(
		async (server: PlexServer) => {
			await selectServer({
				serverUrl: server.uri,
				serverName: server.name,
				machineIdentifier: server.clientIdentifier,
			});
		},
		[selectServer],
	);

	const servers = useMemo(() => data?.servers ?? [], [data?.servers]);

	if (isLoading) {
		return (
			<div className={sectionCard}>
				<h3 className={sectionTitle}>Select Plex Server</h3>
				<p className={statusText}>Loading servers...</p>
			</div>
		);
	}

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>Select Plex Server</h3>
			<ServerSelect servers={servers} onSelect={handleSelect} isLoading={isSelecting} />
		</div>
	);
};

/* ── Main PlexTab ──────────────────────────────────────────── */

export const PlexTab = () => {
	const { data, isLoading, isError } = useGetPlexServersQuery();
	const [disconnect, { isLoading: isDisconnecting }] = useDisconnectPlexMutation();

	const handleDisconnect = useCallback(async () => {
		await disconnect();
	}, [disconnect]);

	if (isLoading) {
		return <p className={statusText}>Loading Plex connection status...</p>;
	}

	if (isError) {
		return <PlexNotConnected />;
	}

	const servers = data?.servers ?? [];
	const selectedServer = servers.find((server) => server.owned);

	if (servers.length > NO_SERVERS && !selectedServer) {
		return <PlexServerSelection />;
	}

	if (selectedServer) {
		return (
			<PlexConnectedCard
				serverName={selectedServer.name}
				onDisconnect={handleDisconnect}
				isDisconnecting={isDisconnecting}
			/>
		);
	}

	return <PlexNotConnected />;
};
