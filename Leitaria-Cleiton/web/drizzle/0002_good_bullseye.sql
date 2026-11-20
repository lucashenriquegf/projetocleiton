ALTER TABLE `road_blocks` ADD `reference` text;--> statement-breakpoint
CREATE INDEX `idx_routes_vehicle_status` ON `route_plans` (`vehicle_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fleet_vehicle_current` ON `vehicle_driver_assignments` (`vehicle_id`) WHERE "vehicle_driver_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fleet_driver_current` ON `vehicle_driver_assignments` (`driver_id`) WHERE "vehicle_driver_assignments"."ended_at" IS NULL;