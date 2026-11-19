CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`nome` text NOT NULL,
	`gancho` text,
	`rodadas` integer DEFAULT true NOT NULL,
	`criado_por` text NOT NULL,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`system_id`) REFERENCES `game_systems`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaigns_system` ON `campaigns` (`system_id`);--> statement-breakpoint
CREATE TABLE `game_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`tipo` text NOT NULL,
	`config` text NOT NULL,
	CONSTRAINT "game_systems_tipo" CHECK("game_systems"."tipo" in ('op2', 'inventado'))
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`user_id` text NOT NULL,
	`provedor` text NOT NULL,
	`id_externo` text NOT NULL,
	`senha_hash` text,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`provedor`, `id_externo`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "identities_provedor" CHECK("identities"."provedor" in ('email', 'discord'))
);
--> statement-breakpoint
CREATE INDEX `identities_user` ON `identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`papel` text NOT NULL,
	`character_id` text,
	PRIMARY KEY(`campaign_id`, `user_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_papel" CHECK("memberships"."papel" in ('mestre', 'jogador'))
);
--> statement-breakpoint
CREATE INDEX `memberships_user` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);