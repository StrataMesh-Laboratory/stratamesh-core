# Cursor on the Fog desk

This hop has **no** `CURSOR_API_KEY` in `~/.config/stratamesh`. Cursor Settings → Models stores BYOK (OpenAI / Anthropic / Gemini) **in the app**, not in our Fog vault.

Plugins / MCP: Customize sidebar → Marketplace (https://cursor.com/marketplace) and cursor.directory. There is no org-wide install API we can call with a Fog token.

## Vault convention (Mac only, 0600)

```
~/.config/stratamesh/cursor.openai
~/.config/stratamesh/cursor.anthropic
~/.config/stratamesh/cursor.gemini
```

Never git. Never chat.

## Project MCP (repo)

`.cursor/mcp.json` is a **template**. Copy to the Fog checkout; fill env from the vault. Do not commit filled keys.
