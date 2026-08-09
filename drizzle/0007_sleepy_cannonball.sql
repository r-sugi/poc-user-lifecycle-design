-- display_name を本体テーブルへ移動（seed_signup_labels には既存行の表示名が入っている）
ALTER TABLE `signup_verifications` ADD `display_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `signup_verifications`
SET `display_name` = COALESCE(
  (SELECT `l`.`display_name` FROM `seed_signup_labels` `l` WHERE `l`.`signup_verification_id` = `signup_verifications`.`id`),
  ''
);
--> statement-breakpoint
ALTER TABLE `seed_signup_labels` DROP COLUMN `display_name`;