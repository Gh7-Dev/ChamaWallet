import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

async function migrate() {
  const client = new Client({ connectionString: DATABASE_URL });
  const sql = fs.readFileSync(path.resolve(__dirname, '../schema.sql'), 'utf8');

  try {
    await client.connect();
    console.log('Connected to PostgreSQL. Running migration...');
    await client.query(sql);
    console.log('Migration complete.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
