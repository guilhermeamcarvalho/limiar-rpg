CREATE TABLE `pois` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`room_id` text,
	`numero` integer NOT NULL,
	`nome` text NOT NULL,
	`descricao` text DEFAULT '' NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`pericias` text DEFAULT '[]' NOT NULL,
	`informacoes` text DEFAULT '[]' NOT NULL,
	`desafio` text,
	`contexto_mestre` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pois_map` ON `pois` (`map_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`nome` text NOT NULL,
	`area` text NOT NULL,
	`notas_mestre` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_map` ON `rooms` (`map_id`);