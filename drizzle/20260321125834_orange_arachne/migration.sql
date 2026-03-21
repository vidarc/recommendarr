CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`username` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
