# Authentication — MediQueue

MediQueue supports two real sign-in methods:

1. **Email + password** — works out of the box. Passwords are hashed with
   PBKDF2-HMAC-SHA256 (120k iterations, per-user salt) and never stored in
   plaintext. Sessions are HMAC-signed bearer tokens (7-day expiry).
2. **Google OAuth (Sign in with Google)** — enabled once you add a Google
   OAuth Client ID (steps below). Until then the Google button is hidden and
   email/password still works.

Both clinics and patients can use either method. On signup the chosen role
(Clinic / Patient) is what a brand-new account is created as; existing accounts
keep their role no matter how they sign in.

## Enable Google sign-in

### 1. Create an OAuth Client ID
1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Create (or pick) a project → **Create credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Under **Authorized JavaScript origins**, add the URLs the app runs on:
   - `http://localhost:5173` (Vite dev)
   - your production origin, e.g. `https://app.yourdomain.com`
5. Create. Copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`).

### 2. Give the Client ID to the backend
The backend reads `GOOGLE_CLIENT_ID` from the environment and exposes it to the
frontend via `GET /api/auth/config`, so you only configure it in one place.

PowerShell (Windows):
```powershell
$env:GOOGLE_CLIENT_ID = "xxxx.apps.googleusercontent.com"
python -m uvicorn main:app --reload
```

bash / macOS / Linux:
```bash
GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com" python -m uvicorn main:app --reload
```

That's it — reload the app and the **Continue with Google** button appears on
the login/signup page.

## How verification works
- The browser uses Google Identity Services to obtain a signed **ID token**.
- The frontend posts it to `POST /api/auth/google`.
- The backend verifies it against Google's official
  `https://oauth2.googleapis.com/tokeninfo` endpoint and checks the token's
  `aud` matches our Client ID, the issuer is Google, and the email is verified.
- A matching account is found by email (or created), and a MediQueue session
  token is returned.

For very high traffic you'd switch the backend to local JWKS verification
(cached Google public keys) instead of the tokeninfo call — the rest of the
flow stays the same.

## Auth endpoints
| Method | Path                 | Purpose                                  |
|--------|----------------------|------------------------------------------|
| POST   | `/api/auth/signup`   | Email/password signup (role, name, email, password) |
| POST   | `/api/auth/login`    | Email/password login                     |
| POST   | `/api/auth/google`   | Exchange a Google ID token for a session |
| GET    | `/api/auth/config`   | Tells the frontend if Google is enabled  |
| GET    | `/api/me`            | Current account from bearer token        |
