# Social login (Google / Microsoft / Apple) — CMN common users

Lab-ready OAuth for **public users**. Staff stays on `/staff/login` + 2FA. CMD/EUDI remain pending.

## Enable

### Google
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → OAuth client (Web)
2. Authorized redirect URI:  
   `https://stratamesh-auth.stratamesh.workers.dev/auth/google/callback`
3. Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
4. Optional: `OAUTH_REDIRECT_BASE`, `PORTAL_URL`

### Microsoft
1. [Azure Portal](https://portal.azure.com/) → App registration
2. Redirect: `https://stratamesh-auth.stratamesh.workers.dev/auth/microsoft/callback`
3. Secrets: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`  
   Optional: `MICROSOFT_TENANT=common`

### Apple
1. Apple Developer → Services ID + Sign in with Apple key
2. Redirect: `…/auth/apple/callback`
3. Secrets: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`  
4. Callback token exchange is partial until keys are present

## Endpoints

| Path | Role |
|------|------|
| `GET /auth/methods` | Which providers are enabled |
| `GET /auth/google/start` | Begin Google |
| `GET /auth/google/callback` | Exchange + session + redirect portal `?token=` |
| same for `microsoft` | |
| `apple` | start live when client id set; callback needs JWT secret |

## Account rules

- Creates/links `users` row by email  
- `clearance_level = basic`  
- `verification_status = verified` when provider confirms email  
- Passwordless (`social_no_password` marker)

## Portal

Buttons on dashboard login: Google / Microsoft / Apple.  
After callback, `?token=` is stored in `localStorage`.
