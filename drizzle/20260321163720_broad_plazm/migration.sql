CREATE TABLE `ai_configs` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`endpoint_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model_name` text NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`max_tokens` integer DEFAULT 2048 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
