# MoeMail CLI — Agent-First Command Line Tool

## Overview

A CLI tool that wraps MoeMail's existing OpenAPI, optimized for AI Agent workflows. Agents can create temporary emails, wait for incoming messages, read content, and manage mailboxes through simple shell commands.

**Goal:** Make MoeMail a first-class tool in any AI Agent's toolchain with minimal friction — one command per action, structured JSON output, zero server-side changes.

## Architecture

```
Agent (Claude / GPT / Custom)
    ↓ shell call
moemail CLI (npm package, bun-built single JS file)
    ↓ HTTPS + X-API-Key header
MoeMail Server (existing Next.js API, no changes)
    ↓
Cloudflare D1 / Email Workers
```

- **Language:** TypeScript
- **Build:** `bun build ./src/index.ts --outdir ./dist --target=node`
- **Distribution:** npm package, `npm i -g moemail-cli`
- **Binary:** `package.json` `bin` field points to `dist/index.js`
- **Location:** `packages/moemail-cli/` in the monorepo
- **Server changes:** None. CLI is a pure API client.

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

All commands support `--json` for JSON output and `--help` for usage info.

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

`--expiry` options: `1h` | `24h` | `3d` | `7d` | `permanent`

Default output:
```
Created: test@moemail.app (expires in 24 hours)
ID: abc-123
```

JSON output (`--json`):
```json
{"id": "abc-123", "address": "test@moemail.app", "expiresAt": "2026-03-23T12:00:00Z"}
```

### `moemail list`

```bash
# List all mailboxes
moemail list

# With pagination
moemail list --cursor xxx
```

### `moemail wait`

The core command for Agent workflows. Polls the API until a new message arrives or timeout.

```bash
# Wait for new message (default: 120s timeout, 5s interval)
moemail wait --email-id xxx

# Custom timeout and interval
moemail wait --email-id xxx --timeout 60 --interval 3
```

**Behavior:**
1. Record current message count/IDs on start
2. Poll `GET /api/emails/{id}` every `--interval` seconds
3. Compare with initial state to detect new messages
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

### `moemail send`

```bash
moemail send --email-id xxx --to user@example.com --subject "Hello" --content "Body text"
```

### `moemail delete`

```bash
# Delete mailbox and all messages
moemail delete --email-id xxx

# Delete single message
moemail delete --email-id xxx --message-id yyy
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
- Server-side: zero changes required

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
