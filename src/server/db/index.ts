/**
 * Drizzle DB client. Uses the `neon-http` driver, which talks to Neon
 * over HTTPS — no connection pool to manage, works seamlessly with
 * Vercel's default Node runtime for serverless functions.
 *
 * Import `db` from this module anywhere on the server. The schema is
 * passed at construction so Drizzle's query builder knows the tables.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "~/env";
import * as schema from "./schema";

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export type Database = typeof db;
