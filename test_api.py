import requests

# Test backend API endpoints
try:
    response = requests.get('http://localhost:8000/api/load-sample-collection')
    print(f'Sample Collection Status: {response.status_code}')
    print(f'Response Type: {response.headers.get("content-type", "unknown")}')
    if response.status_code == 200:
        print('✅ Sample collection endpoint working')
    else:
        print(f'❌ Sample collection endpoint failed: {response.text}')
except Exception as e:
    print(f'❌ Error testing sample collection: {e}')

# Test health endpoint
try:
    response = requests.get('http://localhost:8000/health')
    print(f'\nHealth Status: {response.status_code}')
    if response.status_code == 200:
        print(f'Health Response: {response.json()}')
        print('✅ Health endpoint working')
    else:
        print(f'❌ Health endpoint failed: {response.text}')
except Exception as e:
    print(f'❌ Error testing health: {e}')
