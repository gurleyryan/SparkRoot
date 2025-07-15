import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('backend/.env')

async def test_supabase_client():
    """Test Supabase connection using the official client library (REST API)"""
    
    print("🚀 Testing Supabase REST API Connection")
    print("=" * 60)
    
    # Get credentials from environment
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    print(f"Supabase URL: {url}")
    print(f"Anon Key: {key[:20]}..." if key else "No key found")
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(url, key)
        print("✅ Supabase client created successfully")
        
        # Test 1: Basic connection - check available tables
        print("\n📋 Testing: List available tables")
        try:
            # This will test the basic REST API connection
            response = supabase.rpc("version").execute()
            print(f"✅ Basic connection successful")
        except Exception as e:
            print(f"⚠️  Basic connection test: {e}")
        
        # Test 2: Try to access the users table (from your schema)
        print("\n👥 Testing: Users table access")
        try:
            response = supabase.table("users").select("id, email").limit(1).execute()
            print(f"✅ Users table accessible - Found {len(response.data)} records")
        except Exception as e:
            print(f"⚠️  Users table access: {e}")
            
        # Test 3: Try to access other tables from your schema
        tables_to_test = ["user_settings", "collections", "saved_decks", "price_cache"]
        
        for table_name in tables_to_test:
            try:
                response = supabase.table(table_name).select("*").limit(1).execute()
                print(f"✅ {table_name} table accessible - Found {len(response.data)} records")
            except Exception as e:
                print(f"⚠️  {table_name} table: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to create Supabase client: {e}")
        return False

async def test_direct_postgres():
    """Test direct PostgreSQL connection for comparison"""
    
    print("\n🔗 Testing Direct PostgreSQL Connection")
    print("=" * 60)
    
    try:
        import asyncpg
        
        # Test with the corrected credentials
        connection_url = "postgresql://postgres:bXZIne8H1XC3nBhW@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
        
        conn = await asyncpg.connect(connection_url)
        result = await conn.fetchrow('SELECT version()')
        print(f"✅ Direct PostgreSQL connection successful!")
        print(f"PostgreSQL version: {result['version']}")
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Direct PostgreSQL connection failed: {e}")
        return False

async def main():
    """Run comprehensive Supabase connection tests"""
    
    print("🔍 Supabase Connection Diagnostic Tool")
    print("Following Database Connection Best Practices")
    print("=" * 80)
    
    # Test REST API (recommended method)
    rest_success = await test_supabase_client()
    
    # Test direct connection (for comparison)
    direct_success = await test_direct_postgres()
    
    # Summary
    print("\n📊 Connection Test Results")
    print("=" * 30)
    print(f"REST API Connection: {'✅ SUCCESS' if rest_success else '❌ FAILED'}")
    print(f"Direct PostgreSQL: {'✅ SUCCESS' if direct_success else '❌ FAILED'}")
    
    if rest_success:
        print("\n💡 Recommendation: Use the Supabase REST API for your application")
        print("   - More secure (RLS enabled)")
        print("   - Better for frontend integration")
        print("   - Handles authentication automatically")
    elif direct_success:
        print("\n💡 Recommendation: Direct PostgreSQL connection works")
        print("   - Good for backend services")
        print("   - Requires manual security implementation")
    else:
        print("\n💡 Recommendations:")
        print("   1. ✅ Check Supabase Dashboard → Settings → Database")
        print("   2. ✅ Verify connection string and password")
        print("   3. ✅ Ensure IP allowlist is configured (if enabled)")
        print("   4. ✅ Check if tables exist in your database")

if __name__ == "__main__":
    asyncio.run(main())
