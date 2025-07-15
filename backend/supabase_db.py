import os
import asyncpg
import aiosqlite
from urllib.parse import urlparse
from typing import Optional, Dict, Any, List
import json
import asyncio

class SupabaseDB:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL or SUPABASE_DB_URL environment variable is required")
        self.pool = None
        self.sqlite_conn = None
        self.is_sqlite = self.database_url.startswith("sqlite:///")
    
    async def get_connection(self):
        """Get database connection from pool"""
        if self.is_sqlite:
            if not self.sqlite_conn:
                await self.init_pool()
            return self.sqlite_conn
        else:
            if not self.pool:
                await self.init_pool()
            return await self.pool.acquire()
    
    async def init_pool(self):
        """Initialize connection pool"""
        if self.is_sqlite:
            # For SQLite, extract the path from the URL
            db_path = self.database_url.replace("sqlite:///", "")
            self.sqlite_conn = await aiosqlite.connect(db_path)
            await self.create_tables()
        else:
            self.pool = await asyncpg.create_pool(self.database_url)
    
    async def create_tables(self):
        """Create tables for SQLite (PostgreSQL tables are managed by Supabase)"""
        if self.is_sqlite:
            await self.sqlite_conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    display_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            await self.sqlite_conn.execute('''
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            await self.sqlite_conn.commit()
    
    async def close_pool(self):
        """Close connection pool"""
        if self.is_sqlite:
            if self.sqlite_conn:
                await self.sqlite_conn.close()
        else:
            if self.pool:
                await self.pool.close()
    
    async def execute_query(self, query: str, params: tuple = None, fetch: bool = False):
        """Execute a query with proper error handling"""
        if self.is_sqlite:
            connection = await self.get_connection()
            try:
                if fetch:
                    cursor = await connection.execute(query, params or ())
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]
                else:
                    await connection.execute(query, params or ())
                    await connection.commit()
                    return None
            except Exception as e:
                raise e
        else:
            connection = None
            try:
                connection = await self.get_connection()
                
                if fetch:
                    if params:
                        result = await connection.fetch(query, *params)
                    else:
                        result = await connection.fetch(query)
                    return [dict(row) for row in result]
                else:
                    if params:
                        result = await connection.execute(query, *params)
                    else:
                        result = await connection.execute(query)
                    return result
            except Exception as e:
                raise e
            finally:
                if connection:
                    await self.pool.release(connection)
    
    async def execute_query_one(self, query: str, params: tuple = None):
        """Execute query and return single result"""
        if self.is_sqlite:
            connection = await self.get_connection()
            try:
                cursor = await connection.execute(query, params or ())
                row = await cursor.fetchone()
                return dict(row) if row else None
            except Exception as e:
                raise e
        else:
            connection = None
            try:
                connection = await self.get_connection()
                
                if params:
                    result = await connection.fetchrow(query, *params)
                else:
                    result = await connection.fetchrow(query)
                
                return dict(result) if result else None
            except Exception as e:
                raise e
            finally:
                if connection:
                    await self.pool.release(connection)

# Global instance
db = SupabaseDB()
