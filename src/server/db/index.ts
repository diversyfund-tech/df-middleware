import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

const connectionString = process.env.DATABASE_URL;

// Connection pool configuration
// These values can be tuned based on your database and workload
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || "10", 10);
const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || "30", 10); // seconds
const connectionTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT || "10", 10); // seconds

// Configure postgres client with connection pooling
const client = postgres(connectionString, {
	prepare: false, // Disable prefetch as it is not supported for "Transaction" pool mode
	max: maxConnections, // Maximum number of connections in the pool
	idle_timeout: idleTimeout, // Close idle connections after this many seconds
	connect_timeout: connectionTimeout, // Connection timeout in seconds
});

export const db = drizzle(client, { schema });


