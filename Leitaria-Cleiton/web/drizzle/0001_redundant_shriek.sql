CREATE TABLE `route_responsibility_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`route_plan_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`actor` text DEFAULT 'GESTOR' NOT NULL,
	`notes` text,
	FOREIGN KEY (`route_plan_id`) REFERENCES `route_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_route_responsibility_route_started` ON `route_responsibility_periods` (`route_plan_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `vehicle_driver_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`actor` text DEFAULT 'GESTOR' NOT NULL,
	`notes` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fleet_vehicle_started` ON `vehicle_driver_assignments` (`vehicle_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_fleet_driver_started` ON `vehicle_driver_assignments` (`driver_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`plate` text NOT NULL,
	`normalized_plate` text NOT NULL,
	`internal_code` text,
	`manufacturer` text NOT NULL,
	`model` text NOT NULL,
	`model_year` integer NOT NULL,
	`category` text NOT NULL,
	`traction` text NOT NULL,
	`axle_count` integer,
	`capacity_kg` real NOT NULL,
	`capacity_m3` real NOT NULL,
	`operational_status` text DEFAULT 'AVAILABLE' NOT NULL,
	`base_location_id` text,
	`base_label` text,
	`base_latitude` real,
	`base_longitude` real,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`base_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vehicles_normalized_plate` ON `vehicles` (`normalized_plate`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_status_category` ON `vehicles` (`operational_status`,`category`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_base` ON `vehicles` (`base_location_id`);--> statement-breakpoint
ALTER TABLE `drivers` ADD `base_label` text;--> statement-breakpoint
ALTER TABLE `drivers` ADD `base_latitude` real;--> statement-breakpoint
ALTER TABLE `drivers` ADD `base_longitude` real;--> statement-breakpoint
ALTER TABLE `road_blocks` ADD `restriction_mode` text DEFAULT 'BLOCK_ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE `road_blocks` ADD `required_traction` text;--> statement-breakpoint
ALTER TABLE `road_blocks` ADD `maximum_vehicle_category` text;--> statement-breakpoint
ALTER TABLE `road_blocks` ADD `maximum_axles` integer;--> statement-breakpoint
ALTER TABLE `route_location_pings` ADD `vehicle_id` text REFERENCES vehicles(id);--> statement-breakpoint
ALTER TABLE `route_plans` ADD `vehicle_id` text REFERENCES vehicles(id);