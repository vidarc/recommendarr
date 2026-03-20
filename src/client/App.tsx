import { css } from "@linaria/atomic";
import { useSelector } from "react-redux";
import { Redirect, Route, Switch } from "wouter";
import { useGetSettingsQuery, useGetSetupStatusQuery } from "./api.ts";
import { globals } from "./global-styles.ts";
import { Login } from "./Login.tsx";
import { Register } from "./Register.tsx";
import { colors, fonts, radii, spacing } from "./theme.ts";
import "sanitize.css";
import "sanitize.css/typography.css";
import "sanitize.css/forms.css";
import type { RootState } from "./store.ts";

const appWrapper = css`
	min-height: 100vh;
	display: flex;
	flex-direction: column;
`;

const loadingWrapper = css`
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	color: ${colors.textMuted};
	font-size: 1.1rem;
	letter-spacing: 0.5px;
`;

const dashboardContainer = css`
	max-width: 800px;
	width: 100%;
	margin: 0 auto;
	padding: ${spacing.xl};
`;

const dashboardTitle = css`
	font-size: 2rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.lg};
	letter-spacing: -0.5px;
`;

const settingsList = css`
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: ${spacing.sm};
`;

const settingItem = css`
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	padding: ${spacing.md};
	transition: background 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
	}
`;

const settingKey = css`
	color: ${colors.purple};
	font-family: ${fonts.mono};
	font-size: 0.9rem;
`;

const settingValue = css`
	color: ${colors.green};
	font-family: ${fonts.mono};
	font-size: 0.9rem;
`;

const emptyState = css`
	color: ${colors.textDim};
	text-align: center;
	padding: ${spacing.xl};
`;

const SettingItem = ({ name, value }: { name: string; value: string }) => (
	<li className={settingItem}>
		<span className={settingKey}>{name}</span>: <span className={settingValue}>{value}</span>
	</li>
);

const Dashboard = () => {
	const { data: settings, error, isLoading } = useGetSettingsQuery();

	if (isLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}

	if (error) {
		return <p className={emptyState}>Error loading settings</p>;
	}

	if (!settings) {
		return <p className={emptyState}>No settings found</p>;
	}

	return (
		<div className={dashboardContainer}>
			<h1 className={dashboardTitle}>Recommendarr</h1>
			<ul className={settingsList}>
				{Object.entries(settings).map(([key, value]) => (
					<SettingItem key={key} name={key} value={value} />
				))}
			</ul>
		</div>
	);
};

const ProtectedDashboard = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	if (!user) {
		return <Redirect to="/login" />;
	}
	return <Dashboard />;
};

const LoginPage = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	const { data: setupStatus } = useGetSetupStatusQuery();

	if (user) {
		return <Redirect to="/" />;
	}
	if (setupStatus?.needsSetup) {
		return <Redirect to="/register" />;
	}
	return <Login />;
};

const RegisterPage = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	if (user) {
		return <Redirect to="/" />;
	}
	return <Register />;
};

const CatchAll = () => <Redirect to="/" />;

export const App = () => {
	const { isLoading } = useGetSetupStatusQuery();

	if (isLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}

	return (
		<div className={`${globals} ${appWrapper}`}>
			<Switch>
				<Route path="/login" component={LoginPage} />
				<Route path="/register" component={RegisterPage} />
				<Route path="/" component={ProtectedDashboard} />
				<Route component={CatchAll} />
			</Switch>
		</div>
	);
};
