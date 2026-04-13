-- AddColumn: deliveryLat and deliveryLng on orders table
-- Enables accurate route distance calculation (haversine) and driver radius matching
-- for material delivery transport jobs spawned from orders.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION;
