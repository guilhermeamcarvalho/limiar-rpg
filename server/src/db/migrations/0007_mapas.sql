CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`nome` text NOT NULL,
	`imagem` text NOT NULL,
	`largura` integer NOT NULL,
	`altura` integer NOT NULL,
	`grade` text NOT NULL,
	`nevoa` text DEFAULT '[]' NOT NULL,
	`ativo` integer DEFAULT false NOT NULL,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `maps_campaign` ON `maps` (`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `maps_um_ativo` ON `maps` (`campaign_id`) WHERE "maps"."ativo" = 1;--> statement-breakpoint
CREATE TABLE `props` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`imagem` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`tamanho` real DEFAULT 1 NOT NULL,
	`rotacao` real DEFAULT 0 NOT NULL,
	`travado` integer DEFAULT false NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `props_map` ON `props` (`map_id`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`character_id` text,
	`nome` text NOT NULL,
	`imagem` text,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`tamanho` integer DEFAULT 1 NOT NULL,
	`oculto` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tokens_map` ON `tokens` (`map_id`);