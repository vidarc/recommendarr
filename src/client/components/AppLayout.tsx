import { css } from "@linaria/atomic";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation } from "wouter";

import { api } from "../api.ts";
import { useLogoutMutation } from "../features/auth/api.ts";
import { colors, spacing } from "../theme.ts";

import type { ReactNode } from "react";

const layoutWrapper = css`
	display: flex;
	min-height: 100vh;
`;

const sidebar = css`
	width: 240px;
	background: ${colors.surface};
	border-right: 1px solid ${colors.border};
	display: flex;
	flex-direction: column;
	padding: ${spacing.md} 0;
	flex-shrink: 0;
`;

const sidebarTitle = css`
	font-size: 1.2rem;
	font-weight: 700;
	color: ${colors.accent};
	padding: ${spacing.sm} ${spacing.lg};
	margin-bottom: ${spacing.md};
	letter-spacing: -0.3px;
`;

const navList = css`
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
	padding: 0 ${spacing.sm};
	flex: 1;
`;

const navLinkBase = css`
	display: block;
	padding: ${spacing.sm} ${spacing.md};
	border-radius: 6px;
	color: ${colors.textMuted};
	text-decoration: none;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const navLinkActive = css`
	background: ${colors.bgLighter};
	color: ${colors.accent};

	&:hover {
		color: ${colors.accent};
	}
`;

const sidebarBottom = css`
	padding: ${spacing.sm};
`;

const logoutButton = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	border: 1px solid ${colors.border};
	border-radius: 6px;
	color: ${colors.textMuted};
	cursor: pointer;
	text-align: left;
	font-size: 0.9rem;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.red};
	}
`;

const mainContent = css`
	flex: 1;
	overflow-y: auto;
`;

interface NavItemProps {
	href: string;
	label: string;
	isActive: boolean;
}

const NavItem = ({ href, label, isActive }: NavItemProps) => (
	<li>
		<Link href={href} className={`${navLinkBase} ${isActive ? navLinkActive : ""}`}>
			{label}
		</Link>
	</li>
);

const navItems = [
	{ href: "/", label: "Recommendations" },
	{ href: "/history", label: "History" },
	{ href: "/settings", label: "Settings" },
] as const;

interface AppLayoutProps {
	children: ReactNode;
}

const Sidebar = () => {
	const [location] = useLocation();
	const [logout] = useLogoutMutation();
	const dispatch = useDispatch();

	const handleLogout = useCallback(async () => {
		await logout();
		dispatch(api.util.resetApiState());
	}, [logout, dispatch]);

	return (
		<nav className={sidebar}>
			<p className={sidebarTitle}>Recommendarr</p>
			<ul className={navList}>
				{navItems.map((item) => (
					<NavItem
						key={item.href}
						href={item.href}
						label={item.label}
						isActive={location === item.href}
					/>
				))}
			</ul>
			<div className={sidebarBottom}>
				<button type="button" className={logoutButton} onClick={handleLogout}>
					Log out
				</button>
			</div>
		</nav>
	);
};

export const AppLayout = ({ children }: AppLayoutProps) => (
	<div className={layoutWrapper}>
		<Sidebar />
		<main className={mainContent}>{children}</main>
	</div>
);
