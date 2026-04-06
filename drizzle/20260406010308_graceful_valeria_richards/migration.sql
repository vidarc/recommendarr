PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recommendations` (
	`id` text PRIMARY KEY,
	`message_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`media_type` text NOT NULL,
	`synopsis` text,
	`tmdb_id` integer,
	`added_to_arr` integer DEFAULT false NOT NULL,
	`feedback` text,
	CONSTRAINT "feedback_values" CHECK("feedback" IN ('liked', 'disliked') OR "feedback" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_recommendations`(`id`, `message_id`, `title`, `year`, `media_type`, `synopsis`, `tmdb_id`, `added_to_arr`, `feedback`) SELECT `id`, `message_id`, `title`, `year`, `media_type`, `synopsis`, `tmdb_id`, `added_to_arr`, `feedback` FROM `recommendations`;--> statement-breakpoint
DROP TABLE `recommendations`;--> statement-breakpoint
ALTER TABLE `__new_recommendations` RENAME TO `recommendations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;