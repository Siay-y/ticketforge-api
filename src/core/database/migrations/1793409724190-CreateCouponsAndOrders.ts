import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponsAndOrders1793409724190 implements MigrationInterface {
  name = 'CreateCouponsAndOrders1793409724190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."coupon_discount_type" AS ENUM('percentage', 'fixed_cents')
        `);
    await queryRunner.query(`
            CREATE TABLE "coupons" (
                "id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "code" character varying(32) NOT NULL,
                "discount_type" "public"."coupon_discount_type" NOT NULL,
                "discount_value" integer NOT NULL,
                "max_uses" integer,
                "used_count" integer NOT NULL DEFAULT '0',
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_coupons_used_count_range" CHECK (
                    "used_count" >= 0
                    AND (
                        "max_uses" IS NULL
                        OR "used_count" <= "max_uses"
                    )
                ),
                CONSTRAINT "CHK_coupons_max_uses_positive" CHECK (
                    "max_uses" IS NULL
                    OR "max_uses" > 0
                ),
                CONSTRAINT "CHK_coupons_percentage_max" CHECK (
                    "discount_type" <> 'percentage'
                    OR "discount_value" <= 10000
                ),
                CONSTRAINT "CHK_coupons_discount_value_positive" CHECK ("discount_value" > 0),
                CONSTRAINT "CHK_coupons_code_uppercase" CHECK ("code" = upper("code")),
                CONSTRAINT "PK_coupons" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_coupons_event_code" ON "coupons" ("event_id", "code")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'cancelled', 'expired')
        `);
    await queryRunner.query(`
            CREATE TABLE "orders" (
                "id" uuid NOT NULL,
                "customer_id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "coupon_id" uuid,
                "status" "public"."order_status" NOT NULL DEFAULT 'pending',
                "subtotal_cents" integer NOT NULL,
                "discount_cents" integer NOT NULL,
                "total_cents" integer NOT NULL,
                "idempotency_key" uuid NOT NULL,
                "request_hash" character(64) NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "paid_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_orders_paid_at_consistent" CHECK (("status" = 'paid') = ("paid_at" IS NOT NULL)),
                CONSTRAINT "CHK_orders_total_consistent" CHECK (
                    "total_cents" = "subtotal_cents" - "discount_cents"
                ),
                CONSTRAINT "CHK_orders_discount_within_subtotal" CHECK ("discount_cents" <= "subtotal_cents"),
                CONSTRAINT "CHK_orders_amounts_non_negative" CHECK (
                    "subtotal_cents" >= 0
                    AND "discount_cents" >= 0
                ),
                CONSTRAINT "PK_orders" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_event_id" ON "orders" ("event_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_coupon_id" ON "orders" ("coupon_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_customer_created_at" ON "orders" ("customer_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_status_expires_at" ON "orders" ("status", "expires_at")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_orders_customer_idempotency_key" ON "orders" ("customer_id", "idempotency_key")
        `);
    await queryRunner.query(`
            CREATE TABLE "order_items" (
                "id" uuid NOT NULL,
                "order_id" uuid NOT NULL,
                "batch_id" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price_cents" integer NOT NULL,
                "total_price_cents" integer NOT NULL,
                CONSTRAINT "CHK_order_items_total_consistent" CHECK (
                    "total_price_cents" = "quantity" * "unit_price_cents"
                ),
                CONSTRAINT "CHK_order_items_unit_price_non_negative" CHECK ("unit_price_cents" >= 0),
                CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0),
                CONSTRAINT "PK_order_items" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_order_items_batch_id" ON "order_items" ("batch_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_order_items_order_batch" ON "order_items" ("order_id", "batch_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "coupons"
            ADD CONSTRAINT "FK_coupons_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_customer" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_coupon" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "order_items"
            ADD CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "order_items"
            ADD CONSTRAINT "FK_order_items_batch" FOREIGN KEY ("batch_id") REFERENCES "ticket_batches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_batch"
        `);
    await queryRunner.query(`
            ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_order"
        `);
    await queryRunner.query(`
            ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_coupon"
        `);
    await queryRunner.query(`
            ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_event"
        `);
    await queryRunner.query(`
            ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_customer"
        `);
    await queryRunner.query(`
            ALTER TABLE "coupons" DROP CONSTRAINT "FK_coupons_event"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_order_items_order_batch"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_order_items_batch_id"
        `);
    await queryRunner.query(`
            DROP TABLE "order_items"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_orders_customer_idempotency_key"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_status_expires_at"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_customer_created_at"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_coupon_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_event_id"
        `);
    await queryRunner.query(`
            DROP TABLE "orders"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."order_status"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_coupons_event_code"
        `);
    await queryRunner.query(`
            DROP TABLE "coupons"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."coupon_discount_type"
        `);
  }
}
