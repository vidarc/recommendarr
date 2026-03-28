import { css } from "@linaria/atomic";
import { Suspense, lazy } from "react";
import { Redirect, Route, Switch } from "wouter";

import { AppLayout } from "./components/AppLayout.tsx";
import { useGetMeQuery, useGetSetupStatusQuery } from "./features/auth/api.ts";
import { globals } from "./global-styles.ts";
import { colors } from "./theme.ts";

import "sanitize.css";
import "sanitize.css/typography.css";
import "sanitize.css/forms.css";

const History = lazy(async () => {
	const mod = await import("./pages/History.tsx");
	return { default: mod.History };
});
const Login = lazy(async () => {
	const mod = await import("./pages/Login.tsx");
	return { default: mod.Login };
});
const Recommendations = lazy(async () => {
	const mod = await import("./pages/Recommendations.tsx");
	return { default: mod.Recommendations };
});
const Register = lazy(async () => {
	const mod = await import("./pages/Register.tsx");
	return { default: mod.Register };
});
const Settings = lazy(async () => {
	const mod = await import("./pages/Settings.tsx");
	return { default: mod.Settings };
});

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

const loadingFallback = <p className={loadingWrapper}>Loading...</p>;

const CatchAll = () => <Redirect to="/" />;

const LazyRoutes = () => (
	<Switch>
		<Route path="/" component={Recommendations} />
		<Route path="/history" component={History} />
		<Route path="/settings" component={Settings} />
		<Route component={CatchAll} />
	</Switch>
);

const AuthenticatedRoutes = () => (
	<AppLayout>
		<Suspense fallback={loadingFallback}>
			<LazyRoutes />
		</Suspense>
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
	return (
		<Suspense fallback={loadingFallback}>
			<Login />
		</Suspense>
	);
};

const RegisterPage = () => {
	const { data: user, isLoading } = useGetMeQuery();
	if (isLoading) {
		return <p className={loadingWrapper}>Loading...</p>;
	}
	if (user) {
		return <Redirect to="/" />;
	}
	return (
		<Suspense fallback={loadingFallback}>
			<Register />
		</Suspense>
	);
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
