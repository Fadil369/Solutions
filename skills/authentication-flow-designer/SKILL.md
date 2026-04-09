---
name: "Authentication Flow Designer"
version: "1.0.0"
description: "Designs secure authentication flows including OAuth2, OIDC, MFA, session management, and password reset patterns."
author: "workspace"
activated: false
---

# Authentication Flow Designer

Designs secure, user-friendly authentication flows.

## Decision Framework

### When to Apply
Use when: Login/registration flows, OAuth/OIDC integration, MFA setup, session management, password reset, SSO

### When NOT to Apply
Don't use when: API-key-only auth, internal service-to-service with mTLS

## Anti-Patterns

### 1. Storing Passwords Improperly
```javascript
// BAD: Plain text or weak hash
const hash = md5(password);

// GOOD: bcrypt with salt rounds
const hash = await bcrypt.hash(password, 12);
```

### 2. JWT in localStorage
```javascript
// BAD: XSS vulnerable
localStorage.setItem('token', jwt);

// GOOD: HttpOnly cookie
res.cookie('token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' });
```

### 3. No CSRF Protection
```javascript
// BAD: State-changing GET requests
app.get('/delete-account', (req, res) => { /* deletes account */ });

// GOOD: POST with CSRF token
app.post('/delete-account', csrfProtection, (req, res) => { /* deletes account */ });
```


## Trigger Phrases

- "Add login"
- "Authentication flow"
- "OAuth setup"
- "MFA support"
- "Password reset"
- "Session management"
- "SSO integration"

## Patterns

### OAuth2 + OIDC Flow
```javascript
class AuthService {
  async initiateOAuth(provider) {
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = sha256(codeVerifier).toString('base64url');
    
    await this.sessionStore.set(state, { nonce, codeVerifier, provider });
    return `${provider.authUrl}?${new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256'
    })}`;
  }

  async handleCallback(code, state) {
    const session = await this.sessionStore.get(state);
    if (!session) throw new AuthError('Invalid state');
    const tokens = await this.exchangeCode(code, session.codeVerifier);
    const claims = this.verifyIdToken(tokens.idToken, session.nonce);
    return this.createSession(claims);
  }
}
```

### MFA TOTP
```javascript
class MFAService {
  async setupTOTP(userId) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'MyApp', secret);
    await this.store.saveMFASecret(userId, secret, 'pending');
    return { secret, otpAuthUrl, qrCode: await qrcode.toDataURL(otpAuthUrl) };
  }

  async verifyTOTP(userId, token) {
    const secret = await this.store.getMFASecret(userId);
    return authenticator.verify({ token, secret });
  }
}
```

### Session Management
```javascript
class SessionManager {
  async createSession(userId, metadata) {
    const session = {
      id: crypto.randomUUID(), userId,
      createdAt: Date.now(), expiresAt: Date.now() + (24 * 60 * 60 * 1000),
      ip: metadata.ip, userAgent: metadata.userAgent, mfaVerified: false
    };
    await this.store.set(session.id, session, { EX: 86400 });
    return session;
  }
}
```

## Integration
- Works with: api-integration-layer, database-schema-designer
- Feeds into: notification-system-builder (login alerts)
