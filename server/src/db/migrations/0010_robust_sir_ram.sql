CREATE TABLE `poi_challenges` (
	`campaign_id` text NOT NULL,
	`poi_id` text NOT NULL,
	`estado` text NOT NULL,
	`atualizado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`campaign_id`, `poi_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poi_id`) REFERENCES `pois`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poi_discoveries` (
	`campaign_id` text NOT NULL,
	`poi_id` text NOT NULL,
	`info_id` text NOT NULL,
	`por` text,
	`em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`campaign_id`, `poi_id`, `info_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poi_id`) REFERENCES `pois`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
