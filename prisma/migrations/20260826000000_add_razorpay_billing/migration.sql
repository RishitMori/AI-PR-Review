ALTER TABLE "users"
ADD COLUMN "plan_name" VARCHAR(100) NOT NULL DEFAULT 'Free',
ADD COLUMN "billing_status" VARCHAR(50) NOT NULL DEFAULT 'free',
ADD COLUMN "razorpay_order_id" VARCHAR(100),
ADD COLUMN "razorpay_payment_id" VARCHAR(100),
ADD COLUMN "paid_at" TIMESTAMP(6);

CREATE INDEX "users_billing_status_idx" ON "users"("billing_status");
