import requests
import json
import os
from datetime import datetime

# Set environment variables before testing
os.environ["SUPABASE_URL"] = "https://pvqjgpjnrdlhvowttgmd.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWpncGpucmRsaHZvd3R0Z21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNzY3NDMsImV4cCI6MjA1MTk1Mjc0M30.xEFFqTOIr4OUmyF9vJPGJJ7KK1J6xk7mfOTrh1O4I1s"
os.environ["SUPABASE_SERVICE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWpncGpucmRsaHZvd3R0Z21kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM3Njc0MywiZXhwIjoyMDUxOTUyNzQzfQ.4gfIRG9GJvOJL3fE-iW8ql1zEo5YUgqRjv79D9_LTTg"

# Test Supabase REST API connection
def test_supabase_api():
    base_url = "http://localhost:8001"  # Updated to use port 8001
    
    print("🧪 Testing Complete MTG Deck Optimizer API...")
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"Health check: {response.status_code} - {response.json()}")
        
        if response.status_code != 200:
            print("❌ Server not responding properly")
            print("💡 Make sure to start the server with: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload")
            return
    except Exception as e:
        print(f"❌ Could not connect to server: {e}")
        print("💡 Make sure the server is running with: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload")
        return
    
    # Test 2: Try to register a test user
    print("\n2. Testing user registration...")
    test_user = {
        "email": f"test{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
        "password": "testpassword123",
        "first_name": "Test",
        "last_name": "User"
    }
    
    # Test 2: Try to register a test user
    print("\n2. Testing user registration...")
    import time
    timestamp = int(time.time())
    unique_email = f"testuser{timestamp}@gmail.com"  # Use more standard email format
    test_user = {
        "email": unique_email,
        "password": "TestPassword123!",  # Stronger password for Supabase
        "full_name": "Test User"
    }
    
    print(f"Attempting to create user with email: {unique_email}")
    
    try:
        response = requests.post(f"{base_url}/api/auth/register", json=test_user)
        print(f"Registration attempt: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [200, 201]:
            print("✅ User registration successful!")
            user_data = response.json()
            print(f"User ID: {user_data.get('id')}")
            print(f"Email: {user_data.get('email')}")
            print(f"Full name: {user_data.get('full_name')}")
            
            # Test 3: Try to login with the new user
            print("\n3. Testing login with new user...")
            login_data = {
                "email": unique_email,
                "password": "TestPassword123!"
            }
            login_response = requests.post(f"{base_url}/api/auth/login", json=login_data)
            print(f"Login attempt: {login_response.status_code}")
            print(f"Login response: {login_response.text}")
            
            if login_response.status_code == 200:
                print("✅ Login successful!")
                token_data = login_response.json()
                access_token = token_data.get('access_token')
                print(f"Access token received: {access_token[:30] if access_token else 'None'}...")
                
                # Test 4: Use the token to access a protected endpoint
                print("\n4. Testing protected endpoint...")
                headers = {"Authorization": f"Bearer {access_token}"}
                
                # Test getting user profile
                profile_response = requests.get(f"{base_url}/api/auth/me", headers=headers)
                print(f"Profile access: {profile_response.status_code}")
                if profile_response.status_code == 200:
                    print(f"✅ Profile data: {profile_response.json()}")
                else:
                    print(f"❌ Profile error: {profile_response.text}")
                
                # Test 5: Test collection endpoints
                print("\n5. Testing collection endpoints...")
                collections_response = requests.get(f"{base_url}/api/collections", headers=headers)
                print(f"Collections access: {collections_response.status_code}")
                if collections_response.status_code == 200:
                    print(f"✅ Collections: {collections_response.json()}")
                else:
                    print(f"❌ Collections error: {collections_response.text}")
                    
            else:
                print("❌ Login failed")
                
        elif response.status_code == 400:
            print("⚠️ User might already exist or validation error")
        else:
            print(f"❌ Registration failed: {response.status_code}")
    except Exception as e:
        print(f"Registration error: {e}")
    
    # Test 6: Check available endpoints
    print("\n6. Available endpoints:")
    try:
        response = requests.get(f"{base_url}/docs")
        if response.status_code == 200:
            print("✅ FastAPI docs accessible at http://localhost:8001/docs")
        else:
            print(f"❌ Docs error: {response.status_code}")
    except Exception as e:
        print(f"Docs check error: {e}")
        
    # Test 7: Test deck generation endpoint (using correct path)
    print("\n7. Testing deck generation...")
    try:
        deck_request = {
            "commander": "Atraxa, Praetors' Voice",
            "budget": 100,
            "power_level": 7
        }
        deck_response = requests.post(f"{base_url}/api/generate-deck", json=deck_request)
        print(f"Deck generation: {deck_response.status_code}")
        if deck_response.status_code == 200:
            deck_data = deck_response.json()
            print(f"✅ Generated deck with {len(deck_data.get('deck', []))} cards")
        else:
            print(f"⚠️ Deck generation response: {deck_response.text}")
    except Exception as e:
        print(f"Deck generation error: {e}")
        
    # Test 8: Test sample collection loading (public endpoint)
    print("\n8. Testing sample collection...")
    try:
        sample_response = requests.get(f"{base_url}/api/load-sample-collection")
        print(f"Sample collection: {sample_response.status_code}")
        if sample_response.status_code == 200:
            sample_data = sample_response.json()
            print(f"✅ Sample collection loaded with {len(sample_data.get('collection', []))} cards")
        else:
            print(f"⚠️ Sample collection response: {sample_response.text}")
    except Exception as e:
        print(f"Sample collection error: {e}")

    print(f"\n🏁 API Testing Complete!")
    print(f"📖 View full API documentation at: http://localhost:8001/docs")

if __name__ == "__main__":
    test_supabase_api()
