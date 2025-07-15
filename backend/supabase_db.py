import os
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
from typing import Optional, Dict, Any
import json

class SupabaseDB:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL or SUPABASE_DB_URL environment variable is required")
    
    def get_connection(self):
        """Get database connection"""
        return psycopg2.connect(
            self.database_url,
            cursor_factory=RealDictCursor
        )
    
    def execute_query(self, query: str, params: tuple = None, fetch: bool = False):
        """Execute a query with proper error handling"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, params)
            
            if fetch:
                result = cursor.fetchall()
                conn.commit()
                return result
            else:
                conn.commit()
                return cursor.rowcount
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    def execute_query_one(self, query: str, params: tuple = None):
        """Execute query and return single result"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, params)
            result = cursor.fetchone()
            conn.commit()
            return result
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()

# Global instance
db = SupabaseDB()
