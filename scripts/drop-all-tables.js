const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const databaseClient = process.env.DATABASE_CLIENT || 'sqlite';

async function dropAllTables() {
  let db;
  
  try {
    if (databaseClient === 'sqlite') {
      const sqlite3 = require('better-sqlite3');
      const dbPath = path.join(__dirname, '..', process.env.DATABASE_FILENAME || '.tmp/data.db');
      
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('✓ SQLite database file deleted:', dbPath);
      } else {
        console.log('SQLite database file not found:', dbPath);
      }
    } else if (databaseClient === 'postgres') {
      const { Client } = require('pg');
      
      const client = new Client({
        host: process.env.DATABASE_HOST || 'localhost',
        port: process.env.DATABASE_PORT || 5432,
        database: process.env.DATABASE_NAME || 'strapi',
        user: process.env.DATABASE_USERNAME || 'strapi',
        password: process.env.DATABASE_PASSWORD || 'strapi',
      });
      
      await client.connect();
      
      // Get all tables
      const result = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      
      const tables = result.rows.map(row => row.tablename);
      
      if (tables.length === 0) {
        console.log('✓ No tables found in database');
      } else {
        // Drop all tables
        for (const table of tables) {
          await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
          console.log(`✓ Dropped table: ${table}`);
        }
      }
      
      await client.end();
    } else if (databaseClient === 'mysql') {
      const mysql = require('mysql2/promise');
      
      const connection = await mysql.createConnection({
        host: process.env.DATABASE_HOST || 'localhost',
        port: process.env.DATABASE_PORT || 3306,
        user: process.env.DATABASE_USERNAME || 'strapi',
        password: process.env.DATABASE_PASSWORD || 'strapi',
        database: process.env.DATABASE_NAME || 'strapi',
      });
      
      // Get all tables
      const [tables] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
        [process.env.DATABASE_NAME || 'strapi']
      );
      
      if (tables.length === 0) {
        console.log('✓ No tables found in database');
      } else {
        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS=0');
        
        // Drop all tables
        for (const table of tables) {
          await connection.query(`DROP TABLE IF EXISTS \`${table.TABLE_NAME}\``);
          console.log(`✓ Dropped table: ${table.TABLE_NAME}`);
        }
        
        // Re-enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS=1');
      }
      
      await connection.end();
    }
    
    console.log('\n✓ All database tables have been dropped successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error dropping tables:', error.message);
    process.exit(1);
  }
}

dropAllTables();
