import { css } from "@linaria/atomic";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation } from "wouter";

import { api } from "../api.ts";
import { useLogoutMutation } from "../features/auth/api.ts";
import { colors } from "../theme.ts";
import { Icon } from "./Icon.tsx";
import { Logo } from "./Logo.tsx";

const SIDEBAR_WIDTH = "3.75rem";
const ITEM_HEIGHT = "3.75rem";
const LOGO_SIZE = 28;
const NAV_ICON_SIZE = 17;
const LOGOUT_ICON_SIZE = 16;

const nav = css`
	width: ${SIDEBAR_WIDTH};
	background: ${colors.surface};
	border-right: 1px solid ${colors.border};
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
`;

const logoBlock = css`
	padding: 1.25rem 0 1rem;
	display: flex;
	align-items: center;
	justify-content: center;
	border-bottom: 1px solid ${colors.border};
`;

const list = css`
	list-style: none;
	padding: 0.5rem 0;
	margin: 0;
	flex: 1;
`;

const itemBase = css`
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: ${ITEM_HEIGHT};
	color: ${colors.textMuted};
	background: none;
	border: none;
	cursor: pointer;
	text-decoration: none;
	transition:
		background 0.15s ease,
		color 0.15s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const itemActive = css`
	background: ${colors.accentDim};
	color: ${colors.accent};

	&:hover {
		background: ${colors.accentDim};
		color: ${colors.accent};
	}
`;

const activeBar = css`
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%);
	width: 0.1875rem;
	height: 1.25rem;
	background: ${colors.accent};
	border-radius: 0 0.1875rem 0.1875rem 0;
`;

const bottomRow = css`
	display: flex;
	justify-content: center;
	border-top: 1px solid ${colors.border};
`;

const logoutButton = css`
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: ${ITEM_HEIGHT};
	background: none;
	border: none;
	color: ${colors.textDim};
	cursor: pointer;
	transition: color 0.15s ease;

	&:hover {
		color: ${colors.red};
	}
`;

interface NavItemDef {
	href: string;
	label: string;
	icon: "spark" | "clock" | "settings";
}

const NAV_ITEMS: readonly NavItemDef[] = [
	{ href: "/", label: "Recommendations", icon: "spark" },
	{ href: "/history", label: "History", icon: "clock" },
	{ href: "/settings", label: "Settings", icon: "settings" },
] as const;

interface NavItemProps {
	item: NavItemDef;
	isActive: boolean;
}

const NavItem = ({ item, isActive }: NavItemProps) => (
	<li>
		<Link
			href={item.href}
			aria-label={item.label}
			data-tooltip={item.label}
			aria-current={isActive ? "page" : undefined}
			className={`${itemBase} ${isActive ? itemActive : ""}`}
		>
			{isActive ? <span aria-hidden="true" className={activeBar} /> : undefined}
			<Icon name={item.icon} size={NAV_ICON_SIZE} />
		</Link>
	</li>
);

interface LogoutButtonProps {
	onClick: () => void | Promise<void>;
}

const LogoutButton = ({ onClick }: LogoutButtonProps) => (
	<button
		type="button"
		aria-label="Log out"
		data-tooltip="Log out"
		className={logoutButton}
		onClick={onClick}
	>
		<Icon name="logout" size={LOGOUT_ICON_SIZE} />
	</button>
);

export const Sidebar = () => {
	const [location] = useLocation();
	const [logout] = useLogoutMutation();
	const dispatch = useDispatch();

	const handleLogout = useCallback(async () => {
		await logout();
		dispatch(api.util.resetApiState());
	}, [logout, dispatch]);

	return (
		<nav className={nav}>
			<div className={logoBlock}>
				<Logo size={LOGO_SIZE} />
			</div>
			<ul className={list}>
				{NAV_ITEMS.map((item) => (
					<NavItem key={item.href} item={item} isActive={location === item.href} />
				))}
			</ul>
			<div className={bottomRow}>
				<LogoutButton onClick={handleLogout} />
			</div>
		</nav>
	);
};
