import {
	buttonRow,
	comingSoonLabel,
	primaryButton,
	sectionCard,
	sectionTitle,
} from "./settings-styles.ts";
import { SettingsField } from "./SettingsField.tsx";

const noopChange = () => {};

export const AccountTab = () => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>
			Change Password
			<span className={comingSoonLabel}>Coming Soon</span>
		</h3>
		<SettingsField
			id="currentPassword"
			label="Current Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<SettingsField
			id="newPassword"
			label="New Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<SettingsField
			id="confirmPassword"
			label="Confirm Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<div className={buttonRow}>
			<button type="button" className={primaryButton} disabled>
				Update Password
			</button>
		</div>
	</div>
);
