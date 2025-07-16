import os
import asyncpg


class SupabaseDB:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL or SUPABASE_DB_URL environment variable is required")
        self.pool = None
    
    async def get_connection(self):
        """Get database connection from pool"""
        if not self.pool:
            await self.init_pool()
        return await self.pool.acquire()
    
    async def init_pool(self):
        """Initialize connection pool"""
        self.pool = await asyncpg.create_pool(self.database_url)
    

    
    async def close_pool(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
    
    async def execute_query(self, query: str, params: tuple = None, fetch: bool = False):
        """Execute a query with proper error handling"""
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
