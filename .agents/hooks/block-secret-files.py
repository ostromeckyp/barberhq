#!/usr/bin/env python3
"""PreToolUse hook (Claude Code + Codex): keeps *.local.json and .env files out of the model context.

Input: hook JSON on stdin. Exit 2 blocks the tool call; stderr is the reason shown to the agent.
"""
import json
import re
import sys

LOCAL_JSON = re.compile(r"\.local\.json\b|\*\.local\.\*|\.local\.\*")
# .env, .env.e2e, functions/.env.<project>, .env* globs; not process.env / import.meta.env,
# and not the committed templates .env.example / .env.sample.
ENV_FILE = re.compile(r"(?:^|(?<=[\s/'\"=:(]))\.env(?!\.(?:example|sample)\b)(?=$|[.*\s'\"/;|&)])")

# Commands that print file contents (or copy them somewhere readable).
READER = re.compile(
    r"\b(?:cat|bat|less|more|head|tail|nl|tac|strings|xxd|od|hexdump|base64|sed|awk|"
    r"grep|egrep|fgrep|rg|ag|jq|diff|cmp|cp|mv|tee|open|source|python3?|node|deno|bun|ruby|perl)\b"
    r"|(?:^|[\s;&|])\.\s"
    r"|\bgit\s+(?:show|diff|log\s+-p|cat-file|blame)\b"
)
# Existence checks print nothing from the file.
QUIET = re.compile(r"\b(?:grep|egrep|rg)\b[^|;&]*\s(?:-[A-Za-z]*[qlc][A-Za-z]*|--quiet|--count|--files-with-matches)\b")
# Repo scripts take *.local.json files as --config/--memberships input; that is not a read by the model.
REPO_SCRIPT = re.compile(r"^\s*(?:\w+=\S+\s+)*node\s+--import\s+tsx\s+scripts/\S+\.ts\b[^|;&>]*$")

LOCAL_JSON_REASON = (
    "Blocked: *.local.json files (config/public.local.json, memberships, demo-accounts) "
    "must not enter the model context.\n"
    "Check existence without reading contents, e.g.: test -f config/public.local.json && echo present\n"
    "See config/public.example.json for the structure."
)
ENV_REASON = (
    "Blocked: .env files hold secrets and must not enter the model context.\n"
    "Check existence or a key without the value, e.g.: test -f .env.e2e && echo present, "
    "grep -q '^NAME=' .env.e2e && echo set\n"
    ".env.example and .env.sample are fine to read."
)


def block(reason: str) -> None:
    sys.stderr.write(reason)
    sys.exit(2)


def check(text: str, allow_repo_script: bool = False) -> None:
    if LOCAL_JSON.search(text) and not allow_repo_script:
        block(LOCAL_JSON_REASON)
    if ENV_FILE.search(text):
        block(ENV_REASON)


try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool = data.get("tool_name", "")
inp = data.get("tool_input") or {}

if tool == "Bash":
    cmd = inp.get("command", "") or ""
    if READER.search(cmd) and not QUIET.search(cmd):
        check(cmd, allow_repo_script=bool(REPO_SCRIPT.search(cmd)))
elif tool == "apply_patch":
    # Codex edits: check only the patched paths, not the patch body.
    paths = re.findall(r"^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$", inp.get("command", "") or "", re.M)
    for path in paths:
        check(path)
else:
    # Claude Read/Edit/Write/Grep/Glob/NotebookEdit; a Grep regex mentioning the name is fine.
    fields = " ".join(str(inp.get(k, "")) for k in ("file_path", "path", "glob", "notebook_path"))
    if tool == "Glob":
        fields += " " + str(inp.get("pattern", ""))
    check(fields)

sys.exit(0)
