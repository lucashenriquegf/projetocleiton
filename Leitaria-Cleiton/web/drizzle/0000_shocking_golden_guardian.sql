CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor` text NOT NULL,
	`payload` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `demand_items` (
	`id` text PRIMARY KEY NOT NULL,
	`demand_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`substituted_product_id` text,
	FOREIGN KEY (`demand_id`) REFERENCES `demands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`substituted_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_demand_items_demand` ON `demand_items` (`demand_id`);--> statement-breakpoint
CREATE TABLE `demands` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_location_id` text NOT NULL,
	`delivery_date` text NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'RASCUNHO' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`destination_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_demands_date_status` ON `demands` (`delivery_date`,`status`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`base_location_id` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`base_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_locations_type_active` ON `locations` (`type`,`active`);--> statement-breakpoint
CREATE TABLE `product_substitutions` (
	`id` text PRIMARY KEY NOT NULL,
	`original_product_id` text NOT NULL,
	`substitute_product_id` text NOT NULL,
	`quantity_factor` real DEFAULT 1 NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`original_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`substitute_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_substitutions_original_active` ON `product_substitutions` (`original_product_id`,`active`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`category` text DEFAULT 'ALIMENTO' NOT NULL,
	`perishable` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `road_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`geometry` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `route_cost_config` (
	`id` text PRIMARY KEY NOT NULL,
	`cost_per_kilometer` real NOT NULL,
	`cost_per_hour` real NOT NULL,
	`fixed_trip_cost` real NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `route_location_pings` (
	`id` text PRIMARY KEY NOT NULL,
	`route_plan_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_meters` real,
	`recorded_at` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`route_plan_id`) REFERENCES `route_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pings_route_recorded` ON `route_location_pings` (`route_plan_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `route_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`demand_id` text NOT NULL,
	`name` text NOT NULL,
	`strategy` text NOT NULL,
	`status` text DEFAULT 'CALCULADA' NOT NULL,
	`driver_id` text,
	`distance_km` real NOT NULL,
	`duration_minutes` integer NOT NULL,
	`estimated_cost` real NOT NULL,
	`coverage_percent` real NOT NULL,
	`geometry` text NOT NULL,
	`current_stop` integer DEFAULT 0 NOT NULL,
	`collected_quantity` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`demand_id`) REFERENCES `demands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_routes_status_created` ON `route_plans` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_routes_driver_status` ON `route_plans` (`driver_id`,`status`);--> statement-breakpoint
CREATE TABLE `route_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`route_plan_id` text NOT NULL,
	`location_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'PENDENTE' NOT NULL,
	`planned_arrival` text,
	`planned_summary` text NOT NULL,
	`actual_summary` text,
	FOREIGN KEY (`route_plan_id`) REFERENCES `route_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_route_stops_route_sequence` ON `route_stops` (`route_plan_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `stock_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stock_location_product` ON `stock_balances` (`location_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `supply_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`status` text DEFAULT 'CONFIRMADA' NOT NULL,
	`available_on` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_offers_product_status` ON `supply_offers` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_offers_location_date` ON `supply_offers` (`location_id`,`available_on`);