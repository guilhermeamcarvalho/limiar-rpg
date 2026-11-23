CREATE TABLE `test_log` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`campaign_id` text,
	`user_id` text,
	`origem` text NOT NULL,
	`registro` text NOT NULL,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "test_log_origem" CHECK("test_log"."origem" in ('virtual', 'fisico'))
);
--> statement-breakpoint
CREATE INDEX `test_log_character` ON `test_log` (`character_id`,`criado_em`);