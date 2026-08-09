-- actor_id on events + migrate detail tables to (user_id, seq) PK
ALTER TABLE `user_status_events` ADD `actor_id` text;
--> statement-breakpoint
UPDATE `user_status_events`
SET `actor_id` = (
  SELECT `user_bans`.`admin_user_id` FROM `user_bans` WHERE `user_bans`.`event_id` = `user_status_events`.`id`
)
WHERE `type` = 'banned';
--> statement-breakpoint
UPDATE `user_status_events`
SET `actor_id` = (
  SELECT `user_unbans`.`admin_user_id` FROM `user_unbans` WHERE `user_unbans`.`event_id` = `user_status_events`.`id`
)
WHERE `type` = 'unbanned';
--> statement-breakpoint
CREATE TABLE `user_withdrawals_new` (
	`user_id` text NOT NULL,
	`seq` integer NOT NULL,
	`reason_code` text NOT NULL,
	`reason_text` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `seq`),
	FOREIGN KEY (`user_id`, `seq`) REFERENCES `user_status_events`(`user_id`, `seq`)
);
--> statement-breakpoint
INSERT INTO `user_withdrawals_new` (`user_id`, `seq`, `reason_code`, `reason_text`, `created_at`)
SELECT e.`user_id`, e.`seq`, w.`reason_code`, w.`reason_text`, w.`created_at`
FROM `user_withdrawals` w
INNER JOIN `user_status_events` e ON e.`id` = w.`event_id`;
--> statement-breakpoint
DROP TABLE `user_withdrawals`;
--> statement-breakpoint
ALTER TABLE `user_withdrawals_new` RENAME TO `user_withdrawals`;
--> statement-breakpoint
CREATE TABLE `user_bans_new` (
	`user_id` text NOT NULL,
	`seq` integer NOT NULL,
	`reason_code` text NOT NULL,
	`reason_text` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `seq`),
	FOREIGN KEY (`user_id`, `seq`) REFERENCES `user_status_events`(`user_id`, `seq`)
);
--> statement-breakpoint
INSERT INTO `user_bans_new` (`user_id`, `seq`, `reason_code`, `reason_text`, `created_at`)
SELECT e.`user_id`, e.`seq`, b.`reason_code`, b.`reason_text`, b.`created_at`
FROM `user_bans` b
INNER JOIN `user_status_events` e ON e.`id` = b.`event_id`;
--> statement-breakpoint
DROP TABLE `user_bans`;
--> statement-breakpoint
ALTER TABLE `user_bans_new` RENAME TO `user_bans`;
--> statement-breakpoint
CREATE TABLE `user_unbans_new` (
	`user_id` text NOT NULL,
	`seq` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `seq`),
	FOREIGN KEY (`user_id`, `seq`) REFERENCES `user_status_events`(`user_id`, `seq`)
);
--> statement-breakpoint
INSERT INTO `user_unbans_new` (`user_id`, `seq`, `created_at`)
SELECT e.`user_id`, e.`seq`, u.`created_at`
FROM `user_unbans` u
INNER JOIN `user_status_events` e ON e.`id` = u.`event_id`;
--> statement-breakpoint
DROP TABLE `user_unbans`;
--> statement-breakpoint
ALTER TABLE `user_unbans_new` RENAME TO `user_unbans`;
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`),
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);
--> statement-breakpoint
CREATE INDEX `user_identities_user_id_idx` ON `user_identities` (`user_id`);
--> statement-breakpoint
CREATE INDEX `password_resets_user_id_idx` ON `password_resets` (`user_id`);
--> statement-breakpoint
CREATE INDEX `email_change_requests_user_id_idx` ON `email_change_requests` (`user_id`);
--> statement-breakpoint
CREATE INDEX `signup_verifications_email_idx` ON `signup_verifications` (`email`);
