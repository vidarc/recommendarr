import { css } from "@linaria/atomic";

import { Sidebar } from "./Sidebar.tsx";

import type { ReactNode } from "react";

const layoutWrapper = css`
	display: flex;
	min-height: 100vh;
`;

const mainContent = css`
	flex: 1;
	overflow-y: auto;
`;

interface AppLayoutProps {
	children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => (
	<div className={layoutWrapper}>
		<Sidebar />
		<main className={mainContent}>{children}</main>
	</div>
);
