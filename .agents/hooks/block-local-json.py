#!/usr/bin/env python3
"""PreToolUse hook (Claude Code + Codex): keeps *.local.json files out of the model context.

Input: hook JSON on stdin. Exit 2 blocks the tool call; stderr is the reason shown to the agent.
"""
import json
import re
import sys

LOCAL_JSON = re.compile(r"\.local\.json\b|\*\.local\.\*|\.local\.\*")

# Commands that print file contents (or copy them somewhere readable).
READER = re.compile(
    r"\b(?:cat|bat|less|more|head|tail|nl|tac|strings|xxd|od|hexdump|base64|sed|awk|"
    r"grep|egrep|fgrep|rg|ag|jq|diff|cmp|cp|mv|tee|open|python3?|node|deno|bun|ruby|perl)\b"
    r"|\bgit\s+(?:show|diff|log\s+-p|cat-file|blame)\b"
)
# Existence checks print nothing from the file.
QUIET = re.compile(r"\b(?:grep|egrep|rg)\b[^|;&]*\s(?:-[A-Za-z]*[qlc][A-Za-z]*|--quiet|--count|--files-with-matches)\b")
# Repo scripts take these files as --config/--memberships input; that is not a read by the model.
REPO_SCRIPT = re.compile(r"^\s*(?:\w+=\S+\s+)*node\s+--import\s+tsx\s+scripts/\S+\.ts\b[^|;&>]*$")

REASON = (
    "Blocked: *.local.json files (config/public.local.json, memberships, demo-accounts) "
    "must not enter the model context.\n"
    "Check existence without reading contents, e.g.: test -f config/public.local.json && echo present\n"
    "See config/public.example.json for the structure."
)


def block() -> None:
    sys.stderr.write(REASON)
    sys.exit(2)


try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool = data.get("tool_name", "")
inp = data.get("tool_input") or {}

if tool == "Bash":
    cmd = inp.get("command", "") or ""
    if LOCAL_JSON.search(cmd) and READER.search(cmd) and not QUIET.search(cmd) and not REPO_SCRIPT.search(cmd):
        block()
elif tool == "apply_patch":
    # Codex edits: check only the patched paths, not the patch body.
    paths = re.findall(r"^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$", inp.get("command", "") or "", re.M)
    if any(LOCAL_JSON.search(p) for p in paths):
        block()
else:
    # Claude Read/Edit/Write/Grep/Glob/NotebookEdit; a Grep regex mentioning the name is fine.
    fields = " ".join(str(inp.get(k, "")) for k in ("file_path", "path", "glob", "notebook_path"))
    if LOCAL_JSON.search(fields) or (tool == "Glob" and LOCAL_JSON.search(str(inp.get("pattern", "")))):
        block()

sys.exit(0)
