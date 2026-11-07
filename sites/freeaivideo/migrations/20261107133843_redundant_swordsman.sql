CREATE TABLE `agent_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_keys_key_hash_unique` ON `agent_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `agent_keys_user_idx` ON `agent_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `agent_requests` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`job_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_requests_job_id_unique` ON `agent_requests` (`job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_requests_user_key_idx` ON `agent_requests` (`user_id`,`key`);