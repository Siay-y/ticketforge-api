import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventsAndTicketBatches1792696351806 implements MigrationInterface {
  name = 'CreateEventsAndTicketBatches1792696351806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled', 'finished')
        `);
    await queryRunner.query(`
            CREATE TABLE "events" (
                "id" uuid NOT NULL,
                "organizer_id" uuid NOT NULL,
                "title" character varying(160) NOT NULL,
                "slug" character varying(100) NOT NULL,
                "description" text NOT NULL,
                "venue" character varying(200) NOT NULL,
                "event_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "max_capacity" integer NOT NULL,
                "status" "public"."event_status" NOT NULL DEFAULT 'draft',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "CHK_events_max_capacity_positive" CHECK ("max_capacity" > 0),
                CONSTRAINT "PK_events" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_events_organizer_id" ON "events" ("organizer_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_events_slug" ON "events" ("slug")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_events_status_event_date" ON "events" ("status", "event_date")
            WHERE "deleted_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "ticket_batches" (
                "id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "name" character varying(100) NOT NULL,
                "unit_price_cents" integer NOT NULL,
                "total_quantity" integer NOT NULL,
                "available_quantity" integer NOT NULL,
                "sales_start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "sales_end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "version" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_ticket_batches_sales_period" CHECK ("sales_start_date" < "sales_end_date"),
                CONSTRAINT "CHK_ticket_batches_unit_price_non_negative" CHECK ("unit_price_cents" >= 0),
                CONSTRAINT "CHK_ticket_batches_available_quantity_range" CHECK (
                    "available_quantity" >= 0
                    AND "available_quantity" <= "total_quantity"
                ),
                CONSTRAINT "CHK_ticket_batches_total_quantity_positive" CHECK ("total_quantity" > 0),
                CONSTRAINT "PK_ticket_batches" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_ticket_batches_event_id" ON "ticket_batches" ("event_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "events"
            ADD CONSTRAINT "FK_events_organizer" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "ticket_batches"
            ADD CONSTRAINT "FK_ticket_batches_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Escrito à mão: o TypeORM não gera índice GIN com operator class. Sem ele,
    // a busca `ILIKE '%termo%'` do catálogo varre a tabela inteira.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
            CREATE INDEX "IDX_events_title_trgm" ON "events" USING gin ("title" gin_trgm_ops)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_events_venue_trgm" ON "events" USING gin ("venue" gin_trgm_ops)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A extensão pg_trgm fica: pode ter sido criada antes e servir a outros objetos.
    await queryRunner.query(`DROP INDEX "public"."IDX_events_venue_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_events_title_trgm"`);
    await queryRunner.query(`
            ALTER TABLE "ticket_batches" DROP CONSTRAINT "FK_ticket_batches_event"
        `);
    await queryRunner.query(`
            ALTER TABLE "events" DROP CONSTRAINT "FK_events_organizer"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_ticket_batches_event_id"
        `);
    await queryRunner.query(`
            DROP TABLE "ticket_batches"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_events_status_event_date"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_events_slug"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_events_organizer_id"
        `);
    await queryRunner.query(`
            DROP TABLE "events"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."event_status"
        `);
  }
}
