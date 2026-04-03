CREATE TABLE `library_items` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`media_type` text NOT NULL,
	`source` text NOT NULL,
	`plex_rating_key` text,
	`external_id` text,
	`genres` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`library_sync_interval` text DEFAULT 'manual' NOT NULL,
	`library_sync_last` text,
	`exclude_library_default` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_user_source_title_year_idx` ON `library_items` (`user_id`,`source`,`title`,`year`);