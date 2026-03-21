CREATE TABLE `arr_connections` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`service_type` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arr_user_service_idx` ON `arr_connections` (`user_id`,`service_type`);