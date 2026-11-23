CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`campaign_id` text,
	`system_id` text NOT NULL,
	`ficha` text NOT NULL,
	`foto` text,
	`token_img` text,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`atualizado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`system_id`) REFERENCES `game_systems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `characters_owner` ON `characters` (`owner_id`);--> statement-breakpoint
CREATE INDEX `characters_campaign` ON `characters` (`campaign_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`papel` text NOT NULL,
	`character_id` text,
	`invite_id` text,
	`entrou_em` integer,
	PRIMARY KEY(`campaign_id`, `user_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invite_id`) REFERENCES `invites`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "memberships_papel" CHECK("__new_memberships"."papel" in ('mestre', 'jogador'))
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("campaign_id", "user_id", "papel", "character_id", "invite_id", "entrou_em") SELECT "campaign_id", "user_id", "papel", "character_id", "invite_id", "entrou_em" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `memberships_user` ON `memberships` (`user_id`);