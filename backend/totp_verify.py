import os
import httpx
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY") or ""

router = APIRouter()
security = HTTPBearer()

@router.post("/api/auth/verify-totp")
async def verify_totp(code: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify TOTP code with Supabase Auth API"""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/mfa/verify",
            headers=headers,
            json={"factor_type": "totp", "code": code}
        )
        if resp.status_code == 200:
            return {"success": True}
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")
