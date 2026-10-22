import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1792628503216 implements MigrationInterface {
  name = 'CreateUsers1792628503216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."user_role" AS ENUM('admin', 'organizer', 'customer')
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL,
                "email" character varying(254) NOT NULL,
                "password_hash" character varying(255) NOT NULL,
                "role" "public"."user_role" NOT NULL DEFAULT 'customer',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_users_email_lowercase" CHECK ("email" = lower("email")),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."UQ_users_email"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."user_role"
        `);
  }
}
