CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`campaign_id` text NOT NULL,
	`vagas` integer NOT NULL,
	`usados` integer DEFAULT 0 NOT NULL,
	`expira_em` integer NOT NULL,
	`criado_por` text NOT NULL,
	`criado_em` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`criado_por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invites_vagas" CHECK("invites"."usados" >= 0 and "invites"."usados" <= "invites"."vagas")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_codigo_unique` ON `invites` (`codigo`);--> statement-breakpoint
CREATE INDEX `invites_campaign` ON `invites` (`campaign_id`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `numero` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `proxima_sessao` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_numero_unique` ON `campaigns` (`numero`);--> statement-breakpoint
ALTER TABLE `memberships` ADD `invite_id` text REFERENCES invites(id);--> statement-breakpoint
ALTER TABLE `memberships` ADD `entrou_em` integer;