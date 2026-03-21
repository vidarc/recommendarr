import { css } from "@linaria/atomic";
import { useSelector } from "react-redux";
import { Redirect, Route, Switch } from "wouter";

import { useGetSetupStatusQuery } from "./api.ts";
import { globals } from "./global-styles.ts";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Login } from "./pages/Login.tsx";
import { Register } from "./pages/Register.tsx";
import { colors } from "./theme.ts";

import type { RootState } from "./store.ts";

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
