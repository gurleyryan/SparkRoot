import requests
import json

# Test user registration
test_user = {
    "email": "test3@example.com",
    "password": "testpassword123",
    "first_name": "Test",
    "last_name": "User3",
    "display_name": "TestUser3"
}

try:
    response = requests.post(
        'http://localhost:8000/api/auth/register',
        headers={'Content-Type': 'application/json'},
        json=test_user
    )
    print(f'Registration Status: {response.status_code}')
    print(f'Response: {response.text}')
except Exception as e:
    print(f'Error: {e}')
