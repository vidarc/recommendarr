CREATE TABLE `conversations` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`title` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY,
	`message_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`media_type` text NOT NULL,
	`synopsis` text,
	`tmdb_id` integer,
	`added_to_arr` integer DEFAULT false NOT NULL
);
