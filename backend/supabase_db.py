import os
from typing import Any, Optional, Dict
import asyncpg  # type: ignore # Add this import

class SupabaseDB:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL or SUPABASE_DB_URL environment variable is required")
        self.pool: Optional[asyncpg.pool.Pool] = None  # Correct type annotation
    
    async def get_connection(self) -> Any:
        """Get database connection from pool"""
        if not self.pool:
            await self.init_pool()
        return await self.pool.acquire()  # type: ignore
    
    async def init_pool(self) -> None:
        """Initialize connection pool with statement_cache_size=0 for PgBouncer compatibility"""
        self.pool = await asyncpg.create_pool(self.database_url, statement_cache_size=0)  # type: ignore
    

    
    async def close_pool(self) -> None:
        """Close connection pool"""
        if self.pool:
            await self.pool.close()  # type: ignore
    
    async def execute_query(
        self,
        query: str,
        params: Optional[tuple[Any, ...]] = None,
        fetch: bool = False
    ) -> Any:
        """Execute a query with proper error handling"""
        connection = None
        try:
            connection = await self.get_connection()
            if fetch:
                if params:
                    result = await connection.fetch(query, *params)  # type: ignore
                else:
                    result = await connection.fetch(query)  # type: ignore
                return [dict(row) for row in result]
            else:
                if params:
                    result = await connection.execute(query, *params)  # type: ignore
                else:
                    result = await connection.execute(query)  # type: ignore
                return result
        except Exception as e:
            raise e
        finally:
            if connection:
                await self.pool.release(connection)  # type: ignore
    
    async def execute_query_one(
        self,
        query: str,
        params: Optional[tuple[Any, ...]] = None
    ) -> Optional[Dict[str, Any]]:
        """Execute query and return single result"""
        connection = None
        try:
            connection = await self.get_connection()
            if params:
                result = await connection.fetchrow(query, *params)  # type: ignore
            else:
                result = await connection.fetchrow(query)  # type: ignore
            return dict(result) if result else None
        except Exception as e:
            raise e
        finally:
            if connection:
                await self.pool.release(connection)  # type: ignore

# Global instance
db = SupabaseDB()
