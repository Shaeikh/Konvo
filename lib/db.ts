import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRESQL_URL });

await pool.query(
  ` CREATE TABLE IF NOT EXISTS messages ( id TEXT PRIMARY KEY, user_id TEXT, room TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('normal', 'system')), content TEXT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY (user_id) REFERENCES "user"(id) ); CREATE INDEX IF NOT EXISTS messages_room_id_idx ON messages(room, id); `,
);

export default pool;
