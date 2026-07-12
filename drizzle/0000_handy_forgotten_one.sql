CREATE TABLE `artifact_links` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_instance_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`stage_instance_id`) REFERENCES `stage_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`event` text NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`detail` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`customer_problem_id` text,
	`scope_entry_id` text,
	`status` text NOT NULL,
	`approvals` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_problem_id`) REFERENCES `customer_problems`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scope_entry_id`) REFERENCES `scope_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `checklist_results` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_instance_id` text NOT NULL,
	`item_id` text NOT NULL,
	`checked` integer NOT NULL,
	`by` text NOT NULL,
	`at` text NOT NULL,
	`skip_reason` text,
	FOREIGN KEY (`stage_instance_id`) REFERENCES `stage_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contract_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`description` text NOT NULL,
	`impacted_unit_ids` text NOT NULL,
	`approvals` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_a_id` text NOT NULL,
	`unit_b_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`unit_a_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_b_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customer_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`artifact_link_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_link_id`) REFERENCES `artifact_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gate_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_id` text NOT NULL,
	`project_id` text NOT NULL,
	`unit_id` text,
	`approver_id` text NOT NULL,
	`understanding_check` text NOT NULL,
	`regression_check` text NOT NULL,
	`decision` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gate_approvals_unique_approval` ON `gate_approvals` (`project_id`,`gate_id`,coalesce(`unit_id`, ''),`approver_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`roles` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mob_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_instance_id` text NOT NULL,
	`participant_member_ids` text NOT NULL,
	`held_at` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`stage_instance_id`) REFERENCES `stage_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`depth_profile` text NOT NULL,
	`template_version` text NOT NULL,
	`template_snapshot` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scope_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`feature` text NOT NULL,
	`in_out` text NOT NULL,
	`decided_at` text NOT NULL,
	`reason` text NOT NULL,
	`resurrected_at` text,
	`resurrected_by` text,
	`resurrect_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resurrected_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `stage_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`unit_id` text,
	`stage_def_id` text NOT NULL,
	`status` text NOT NULL,
	`status_changed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`customer_problem_id` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_problem_id`) REFERENCES `customer_problems`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `story_units` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `unit_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`member_id` text NOT NULL,
	`is_representative` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`difficulty_assessment` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
