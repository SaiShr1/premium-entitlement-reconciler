import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {

  const logger = new Logger('runMigration')

  const sqlDir = path.join(__dirname, 'sql');
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf-8');
    logger.log(`Running migration: ${file}`);
    await pool.query(sql);
  }
  logger.log('All migrations applied.');
}