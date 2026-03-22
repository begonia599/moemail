# MoeMail CLI — Agent-First Command Line Tool

## Overview

A CLI tool that wraps MoeMail's existing OpenAPI, optimized for AI Agent workflows. Agents can create temporary emails, wait for incoming messages, read content, and manage mailboxes through simple shell commands.

**Goal:** Make MoeMail a first-class tool in any AI Agent's toolchain with minimal friction — one command per action, structured JSON output, minimal server-side changes.

**Server-side changes:** One small change required — the `POST /api/emails/{id}/send` endpoint currently uses session-only auth. It needs to be updated to also support API Key auth (switch from `auth()` to `getUserId()`) so the CLI `send` command works.

## Architecture

```
Agent (Claude / GPT / Custom)
    ↓ shell call
moemail CLI (npm package, bun-built single JS file)
    ↓ HTTPS + X-API-Key header
MoeMail Server (existing Next.js API, one minor auth change for send endpoint)
    ↓
Cloudflare D1 / Email Workers
```

- **Language:** TypeScript
- **Build:** `bun build ./src/index.ts --outdir ./dist --target=node`
- **Distribution:** npm package, `npm i -g moemail-cli`
- **Binary:** `package.json` `bin` field points to `dist/index.js`
- **Location:** `packages/moemail-cli/` in the monorepo
- **Server changes:** One change — update send endpoint to support API Key auth.

## Configuration

Stored at `~/.moemail/config.json`:

```json
{
  "apiUrl": "https://moemail.app",
  "apiKey": "mk_xxxxxxxx"
}
```

Environment variable overrides (higher priority):
- `MOEMAIL_API_URL`
- `MOEMAIL_API_KEY`

## Commands

All commands support `--json` for JSON output, `--help` for usage info, and `moemail --version` for version.

**Field naming convention:** CLI JSON output uses camelCase (`messageId`, `receivedAt`, `fromAddress`). The API uses snake_case (`message_id`, `received_at`, `from_address`). The CLI transforms all field names to camelCase, and converts epoch ms timestamps to ISO 8601 strings.

### `moemail config`

```bash
# Interactive setup
moemail config

# Direct set
moemail config set api-url https://moemail.app
moemail config set api-key mk_xxxxxxxx

# View current config
moemail config list
```

### `moemail create`

```bash
# Random prefix, 1h expiry (defaults)
moemail create

# With parameters
moemail create --name test --domain moemail.app --expiry 24h
```

`--expiry` options and API mapping:

| CLI flag | API `expiryTime` (ms) |
|----------|----------------------|
| `1h` | `3600000` |
| `24h` | `86400000` |
| `3d` | `259200000` |
| `permanent` | `0` |

Default output:
```
Created: test@moemail.app (expires in 24 hours)
ID: abc-123
```

JSON output (`--json`):
```json
{"id": "abc-123", "address": "test@moemail.app", "expiresAt": "2026-03-23T12:00:00Z"}
```

Note: The API returns `{ id, email }`. The CLI renames `email` → `address` for clarity, and computes `expiresAt` from the chosen expiry option.

### `moemail list`

```bash
# List all mailboxes
moemail list

# List messages in a mailbox
moemail list --email-id xxx

# With pagination
moemail list --cursor xxx
```

JSON output — mailboxes (`--json`):
```json
{"emails": [{"id": "abc-123", "address": "test@moemail.app", "expiresAt": "..."}], "nextCursor": "xxx", "total": 5}
```

JSON output — messages (`--json --email-id xxx`):
```json
{"messages": [{"id": "msg-1", "from": "sender@example.com", "subject": "Hello", "receivedAt": "..."}], "nextCursor": null, "total": 2}
```

### `moemail wait`

The core command for Agent workflows. Polls the API until a new message arrives or timeout.

```bash
# Wait for new message (default: 120s timeout, 5s interval)
moemail wait --email-id xxx

# Custom timeout and interval
moemail wait --email-id xxx --timeout 60 --interval 3
```

**Parameters:** `--timeout` and `--interval` are in seconds.

**Behavior:**
1. Fetch current message list, record all existing message IDs in a Set
2. Poll `GET /api/emails/{id}` every `--interval` seconds
3. Compare returned message IDs against the initial Set to detect new messages (ID-based, not count-based — safe against concurrent deletes)
4. On new message: output message summary and exit with code 0
5. On timeout: exit with code 1

Default output:
```
Polling... (15/120s)
New message from no-reply@github.com: "Verify your email"
Message ID: msg-456
```

JSON output (`--json`):
```json
{"messageId": "msg-456", "from": "no-reply@github.com", "subject": "Verify your email", "receivedAt": "2026-03-22T12:05:00Z"}
```

### `moemail read`

```bash
# Read message (default: plain text)
moemail read --email-id xxx --message-id yyy

# HTML format
moemail read --email-id xxx --message-id yyy --format html
```

`--format` options: `text` (default) | `html`

JSON output (`--json`):
```json
{"id": "msg-456", "from": "no-reply@github.com", "to": "test@moemail.app", "subject": "Verify your email", "content": "Your code is 123456", "html": "<p>Your code is 123456</p>", "receivedAt": "2026-03-22T12:05:00Z", "type": "received"}
```

### `moemail send`

```bash
moemail send --email-id xxx --to user@example.com --subject "Hello" --content "Body text"
```

JSON output (`--json`):
```json
{"success": true, "remainingEmails": 4}
```

### `moemail delete`

```bash
# Delete mailbox and all messages
moemail delete --email-id xxx

# Delete single message
moemail delete --email-id xxx --message-id yyy
```

JSON output (`--json`):
```json
{"success": true}
```

## Output Specification

### Modes

| Mode | Flag | Format | Use case |
|------|------|--------|----------|
| Text | (default) | Human-readable | Debugging, manual use |
| JSON | `--json` | Single-line JSON on stdout | Agent consumption |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Operation failed (timeout, not found, bad params) |
| 2 | Auth failed (invalid/expired API Key) |

### Error Handling

- Errors write to **stderr**, never stdout
- In `--json` mode, stdout contains only valid JSON (or nothing on failure)
- Agent reads stdout for data, checks exit code for success/failure

```bash
$ moemail wait --email-id xxx --timeout 10 --json
# stderr: Polling... (3/10s)
# stderr: Timeout: no new messages received
# stdout: (empty)
# exit code: 1
```

## Project Structure

```
packages/moemail-cli/
├── src/
│   ├── index.ts          # Entry point, command registration
│   ├── commands/
│   │   ├── config.ts     # config command
│   │   ├── create.ts     # create command
│   │   ├── list.ts       # list command
│   │   ├── wait.ts       # wait command (client-side polling)
│   │   ├── read.ts       # read command
│   │   ├── send.ts       # send command
│   │   └── delete.ts     # delete command
│   ├── api.ts            # HTTP client wrapping all API calls
│   ├── config.ts         # Read/write ~/.moemail/config.json
│   └── output.ts         # Output formatting (text / json)
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

- **commander** — CLI argument parsing and subcommand routing
- All other needs (HTTP, filesystem) use Node.js built-in APIs

## Relationship to Main Project

- Lives in `packages/moemail-cli/`, published as a separate npm package
- No code shared with the main Next.js app
- Only coupling is the API contract (URLs, request/response shapes)
- Server-side: one change — send endpoint auth support for API Key

## Typical Agent Workflow

```bash
# 1. Create a temporary mailbox
EMAIL=$(moemail create --domain moemail.app --expiry 1h --json)
EMAIL_ID=$(echo $EMAIL | jq -r '.id')
ADDRESS=$(echo $EMAIL | jq -r '.address')

# 2. Use the address to sign up for a service (agent does this elsewhere)

# 3. Wait for verification email
MSG=$(moemail wait --email-id $EMAIL_ID --timeout 120 --json)
MSG_ID=$(echo $MSG | jq -r '.messageId')

# 4. Read the email content
CONTENT=$(moemail read --email-id $EMAIL_ID --message-id $MSG_ID --json)

# 5. Agent extracts verification code from content (LLM does this)

# 6. Clean up
moemail delete --email-id $EMAIL_ID
```
