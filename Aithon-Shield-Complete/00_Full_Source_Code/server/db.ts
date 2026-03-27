import { config as loadEnv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { validateProductionEnv } from "./env";

const __dbDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dbDir, "../.env") });

neonConfig.webSocketConstructor = ws;

validateProductionEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
