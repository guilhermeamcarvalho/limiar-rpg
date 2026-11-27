CREATE TABLE `clue_holders` (
	`clue_id` text NOT NULL,
	`character_id` text NOT NULL,
	`apresentada` integer DEFAULT false NOT NULL,
	`em` text NOT NULL,
	PRIMARY KEY(`clue_id`, `character_id`),
	FOREIGN KEY (`clue_id`) REFERENCES `clues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clue_holders_character` ON `clue_holders` (`character_id`);--> statement-breakpoint
CREATE TABLE `clues` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`titulo` text NOT NULL,
	`texto` text DEFAULT '' NOT NULL,
	`nota_mestre` text DEFAULT '' NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`visivel` integer DEFAULT false NOT NULL,
	`descoberta` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clues_map` ON `clues` (`map_id`);