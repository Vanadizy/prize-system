// db.js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "guestdb",
  password: "V@n@d1zy",
  port: 5432,
});
