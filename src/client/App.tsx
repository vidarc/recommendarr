import { css } from "@linaria/atomic";
import { Redirect, Route, Switch } from "wouter";

import { useGetMeQuery, useGetSetupStatusQuery } from "./api.ts";
import { AppLayout } from "./components/AppLayout.tsx";
import { globals } from "./global-styles.ts";
import { Login } from "./pages/Login.tsx";
import { Register } from "./pages/Register.tsx";
import { Settings } from "./pages/Settings.tsx";
import { colors, spacing } from "./theme.ts";

import "sanitize.css";
import "sanitize.css/typography.css";
import "sanitize.css/forms.css";

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

const placeholderPage = css`
	max-width: 800px;
	width: 100%;
	margin: 0 auto;
	padding: ${spacing.xl};
`;

const placeholderTitle = css`
	font-size: 2rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.md};
	letter-spacing: -0.5px;
`;

const placeholderText = css`
	color: ${colors.textMuted};
`;

const Recommendations = () => (
	<div className={placeholderPage}>
		<h1 className={placeholderTitle}>Recommendations</h1>
		<p className={placeholderText}>Coming soon.</p>
	</div>
);

const History = () => (
	<div className={placeholderPage}>
		<h1 className={placeholderTitle}>History</h1>
		<p className={placeholderText}>Coming soon.</p>
	</div>
);

const CatchAll = () => <Redirect to="/" />;

const AuthenticatedRoutes = () => (
	<AppLayout>
		<Switch>
			<Route path="/" component={Recommendations} />
			<Route path="/history" component={History} />
			<Route path="/settings" component={Settings} />
			<Route component={CatchAll} />
		</Switch>
	</AppLayout>
);

const ProtectedApp = () => {
	const { data: user, isLoading } = useGetMeQuery();
	if (isLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}
	if (!user) {
		return <Redirect to="/login" />;
	}
	return <AuthenticatedRoutes />;
};

const LoginPage = () => {
	const { data: user, isLoading: isMeLoading } = useGetMeQuery();
	const { data: setupStatus } = useGetSetupStatusQuery();

	if (isMeLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}
	if (user) {
		return <Redirect to="/" />;
	}
	if (setupStatus?.needsSetup) {
		return <Redirect to="/register" />;
	}
	return <Login />;
};

const RegisterPage = () => {
	const { data: user, isLoading } = useGetMeQuery();
	if (isLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}
	if (user) {
		return <Redirect to="/" />;
	}
	return <Register />;
};

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
				<Route component={ProtectedApp} />
			</Switch>
		</div>
	);
};
