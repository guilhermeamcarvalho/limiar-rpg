ALTER TABLE `campaigns` ADD `tom` text DEFAULT 'horror-investigativo' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `formato` text DEFAULT 'campanha-curta' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `nivel_inicial` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `dt_padrao` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `dados_fisicos` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `fichas_visiveis` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `agenda` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `encerrado_em` integer;