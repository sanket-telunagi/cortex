# Cortex Studio: Security, Credential Vault & Cryptography Architecture

> **Guiding Principle**: **The host server and hosting provider have zero mathematical ability to read, decrypt, or log user database passwords, SSH private keys, or API tokens.**

---

## 1. Threat Model & Security Boundaries

In standard client-server devtools, database credentials and SSH private keys are sent to the central backend in plain text and stored in a database (like MySQL or Postgres). 
- If the server is breached, **all customer credentials are stolen**.
- If a rogue administrator inspects the database or memory, **all infrastructure keys are exposed**.

### Cortex Studio Zero-Knowledge Model

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BOUNDARY (USER BROWSER)                            │
│                                                                                        │
│   User Master Passphrase                                                               │
│          │                                                                             │
│          ▼ (Argon2id / PBKDF2 with 100,000+ iterations + unique per-user salt)        │
│   Client Master Key (256-bit AES-GCM Key) [NEVER SENT TO NETWORK]                      │
│          │                                                                             │
│          ├──► Encrypts SSH Keys, Passwords, Tokens with AES-256-GCM                    │
│          │                                                                             │
│          ▼                                                                             │
│   Ciphertext Blob + Random 96-bit Nonce/IV + Auth Tag                                  │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼ (Encrypted Ciphertext only)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER BOUNDARY (CORTEX BACKEND)                          │
│                                                                                        │
│   SQLite / Persistent Storage                                                          │
│   - Stores ONLY raw encrypted ciphertext strings: `enc:v1:nonce:ciphertext:tag`       │
│   - Without the user's passphrase, ciphertext is indistinguishable from random bytes   │
│                                                                                        │
│   Execution Path (When Running a Query or Dialing a Tunnel):                           │
│   1. User initiates a query or establishes an SSH tunnel.                              │
│   2. Browser sends an ephemeral, session-bound decryption token over TLS.              │
│   3. Cortex Backend decrypts the secret strictly in volatile RAM (zero disk writes).   │
│   4. Ephemeral memory is zeroed immediately after connection establishment.            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cryptographic Primitives & Specifications

| Purpose | Algorithm / Standard | Parameters / Key Size |
| :--- | :--- | :--- |
| **Key Derivation** | **Argon2id** (or WebCrypto PBKDF2 fallback) | 256-bit key output, 64MB memory cost, 4 iterations, unique 128-bit salt per account. |
| **Symmetric Encryption** | **AES-256-GCM** (Galois/Counter Mode) | 256-bit key, 96-bit random IV (nonce) generated per encryption, 128-bit authentication tag. |
| **Transport Security** | **TLS 1.3 / WSS (Secure WebSockets)** | Forward secrecy (ECDHE), enforcing encrypted transport for all API calls and telemetry streams. |
| **Team Sharing** | **Asymmetric Envelope Encryption** (X25519 + ChaCha20-Poly1305) | Shared connection profiles encrypted using project keys, sealed per team member's public key. |

---

## 3. How Different Credentials Are Stored & Handled

### A. Database Passwords
1. When you enter a database password (e.g. Postgres, MySQL):
   - The browser generates a random 12-byte initialization vector (`IV`).
   - Browser calls `window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)`.
   - The resulting payload is formatted as:
     `$cortex$v1$<salt>$<iv>$<ciphertext>$<auth_tag>`
2. The server receives and stores **only** this string in SQLite.
3. If an attacker dumps the SQLite database, they receive only encrypted bytes.

### B. SSH Private Keys
1. SSH private keys (`id_ed25519`, `id_rsa`) are parsed and validated client-side.
2. The entire PEM block is encrypted via AES-256-GCM prior to transmission.
3. When establishing a multi-hop tunnel:
   - Decryption takes place inside an ephemeral Go goroutine.
   - The unencrypted key is turned directly into an `ssh.Signer` in memory and is **never written to any temporary file or swap space**.

### C. API Keys & AI Tokens (MCP / OpenAI / Anthropic)
1. Kept in the same client-encrypted vault.
2. If using local AI models (via Ollama or local inference), tokens never leave your network.

---

## 4. Real-Time Telemetry & Update Engine

How the dashboard streams continuous latency updates without server strain:

```
┌─────────────────┐                                  ┌──────────────────┐
│  Cortex Engine  │                                  │  Web Dashboard   │
│ (Worker Thread) │                                  │ (React 19 Canvas)│
└────────┬────────┘                                  └────────▲─────────┘
         │                                                    │
         │ 1. Synthetic Micro-Pings (Every 2000ms)            │
         ├────────────────────────────────────────────────────┤
         │                                                    │
         │ 2. Binary WebSocket Push (`telemetry_tick`)        │
         ├───────────────────────────────────────────────────►│
         │                                                    │
         │                                        3. Updates Sparkline
         │                                           without re-rendering
         │                                           entire DOM tree
```

- **Transport**: Persistent WebSocket connection (`/api/network/telemetry/ws`).
- **Telemetry Payload**: Lightweight JSON tick carrying `{ hop_id, latency_ms, timestamp, status }`.
- **UI Rendering**: Rendered with lightweight SVG bars / sparklines, keeping CPU usage below 1% in background tabs.
