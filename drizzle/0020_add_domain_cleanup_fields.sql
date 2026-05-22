ALTER TABLE `domain` ADD `cleanup_policy` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `domain` ADD `cleanup_after` integer;--> statement-breakpoint
ALTER TABLE `domain` ADD `last_used_at` integer;--> statement-breakpoint
CREATE INDEX `domain_cleanup_policy_idx` ON `domain` (`cleanup_policy`);--> statement-breakpoint
CREATE INDEX `domain_cleanup_after_idx` ON `domain` (`cleanup_after`);