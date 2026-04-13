CREATE TABLE `metadata_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`external_id` integer NOT NULL,
	`source` text NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`overview` text,
	`poster_url` text,
	`genres` text,
	`rating` real,
	`year` integer,
	`cast` text,
	`crew` text,
	`status` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recommendations` ADD `tvdb_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `metadata_external_source_idx` ON `metadata_cache` (`external_id`,`source`);