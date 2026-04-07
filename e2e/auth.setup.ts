import { expect, test as setup } from "@playwright/test";
import { z } from "zod";

import { adminPassword, adminUsername, storageStatePath } from "./constants.ts";

const setupStatusSchema = z.object({ needsSetup: z.boolean() });

setup("register and authenticate", async ({ page }) => {
	const setupStatus = await page.request.get("/api/auth/setup-status");
	const { needsSetup } = setupStatusSchema.parse(await setupStatus.json());

	if (needsSetup) {
		// Fresh database — verify redirect to register, then create the admin user
		await page.goto("/");
		await expect(page).toHaveURL(/\/register/);

		await page.goto("/register");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password", { exact: true }).fill(adminPassword);
		await page.getByLabel("Confirm Password").fill(adminPassword);
		await page.getByRole("button", { name: /register/i }).click();
		await expect(page).toHaveURL("/");
	} else {
		// User already exists (e.g. from a previous project's setup) — just log in
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();
		await expect(page).toHaveURL("/");
	}

	await page.context().storageState({ path: storageStatePath });
});
