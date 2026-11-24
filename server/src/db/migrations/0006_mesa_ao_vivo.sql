CREATE TABLE `session_log` (
	`campaign_id` text NOT NULL,
	`seq` integer NOT NULL,
	`tipo` text NOT NULL,
	`dados` text NOT NULL,
	`em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`campaign_id`, `seq`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `table_states` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`estado` text NOT NULL,
	`seq` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
