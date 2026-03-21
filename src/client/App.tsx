import { css } from "@linaria/atomic";
import { Redirect, Route, Switch } from "wouter";

import { useGetMeQuery, useGetSetupStatusQuery } from "./api.ts";
import { AppLayout } from "./components/AppLayout.tsx";
import { globals } from "./global-styles.ts";
import { History } from "./pages/History.tsx";
import { Login } from "./pages/Login.tsx";
import { Recommendations } from "./pages/Recommendations.tsx";
import { Register } from "./pages/Register.tsx";
import { Settings } from "./pages/Settings.tsx";
import { colors } from "./theme.ts";

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
