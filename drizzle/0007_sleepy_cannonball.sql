ALTER TABLE `signup_verifications` ADD `display_name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `seed_signup_labels` DROP COLUMN `display_name`;