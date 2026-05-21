import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error("DATABASE_URL is missing. Export it before running the activity migration.");
	process.exit(1);
}

const migrationPath = path.join(
	process.cwd(),
	"src",
	"drizzle",
	"migrations",
	"0001_activity_center.sql"
);

const sql = await readFile(migrationPath, "utf8");
const client = new Client({ connectionString: databaseUrl });

try {
	await client.connect();
	await client.query(sql);
	console.log("Activity Center migration applied successfully.");
} catch (error) {
	console.error("Failed to apply Activity Center migration.");
	console.error(error);
	process.exitCode = 1;
} finally {
	await client.end().catch(() => undefined);
}
