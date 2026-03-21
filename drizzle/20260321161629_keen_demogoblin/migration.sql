CREATE TABLE `plex_connections` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`auth_token` text NOT NULL,
	`server_url` text,
	`server_name` text,
	`machine_identifier` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
