-- Goals can count only one activity category (Transport, Energy, Food, Waste).
-- NULL means every activity counts, which is how all existing goals behave.
ALTER TABLE "Goal" ADD COLUMN "category" VARCHAR(32);
