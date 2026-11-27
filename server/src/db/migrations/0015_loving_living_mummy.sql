CREATE TABLE `gm_notes` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`notas` text NOT NULL,
	`atualizado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
