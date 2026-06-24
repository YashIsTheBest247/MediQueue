import base64
import hashlib
import hmac
import json
import os
import secrets
import time

SECRET = os.environ.get("MEDIQUEUE_SECRET", "dev-secret-change-me").encode()
TOKEN_TTL = 60 * 60 * 24 * 7
ITERATIONS = 120000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2${ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def create_token(account_id: int, role: str) -> str:
    payload = {"id": account_id, "role": role, "exp": int(time.time()) + TOKEN_TTL}
    body = _b64e(json.dumps(payload).encode())
    sig = _b64e(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def decode_token(token: str):
    try:
        body, sig = token.split(".")
        expected = _b64e(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64d(body))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None
