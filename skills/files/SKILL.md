---
name: files
description: Manage Sim workspace files and folders through the sim CLI. Use when listing, uploading, reading, searching, moving, renaming, sharing, restoring, or making exact or anchor-based edits to workspace files; not for knowledge-base ingestion or local filesystem edits.
---

# Manage Sim Workspace Files

Use server-side folder, search, and edit operations instead of downloading a workspace tree or
rewriting a whole file when a narrower operation expresses the request.

## Establish context

- Use the profile the user named. If none was named, inspect configured profiles and current
  context; do not silently switch accounts, workspaces, or API origins.
- Start with `sim --output json files ls [path]` when navigating files and child folders together.
  Use `files list` for file-only filtering and `files folders list` for folder-only traversal.
- Keep file ids returned by list, upload, and create operations. File mutations use the id, not a
  name or path that could identify several files.
- Read `sim files --help` and the relevant subcommand help when the installed CLI may differ from
  these instructions. Do not guess a newly introduced flag.

Folder paths use the same slash-delimited form shown in the app; the leading slash is optional. The
CLI encodes individual path segments, so pass the displayed path rather than percent-encoding it.

## Scope discovery on the server

List one folder without descendants:

```bash
sim --output json files list --folder "Reports/2026" --no-recursive
```

Add `--recursive` when descendants belong in the result. With `files list`, recursion defaults to
false for an ordinary folder listing and true when `--search` is present. With no `--folder`, the
list already spans the workspace and a recursion flag has no effect.

Search file names with `files list --search`. Search text contents with `files search`:

```bash
sim --output json files search \
  --query "invoice_[0-9]+" --mode regex \
  --folder "Reports" "Exports" --include-subfolders
```

`--folder` on `files search` accepts several folder paths. Omit it to search the whole workspace.
Use `--mode exact` for literal text and `--no-include-subfolders` when only the selected folders
should be searched. Do not fetch every file and search locally when the server-side query suffices.

## Create and organize deliberately

Upload a local file or create textual content directly:

```bash
sim --output json files upload ./report.csv --folder "Reports/2026"
sim --output json files create --name notes.md --folder "Reports/2026" --content "# Notes"
```

Create nested folders with `files mkdir <path>` or `files folders create <path>`. Move or rename a
folder atomically with `files folders move <path> <destination>`. Move known files with
`files move --file-ids <id...> --to <folder>`; omit `--to` to move them to the workspace root.

File names are leaf names, not paths. Use `files rename <fileId> --name <name>` to change one and
`files move` to change its folder. Do not place path separators or dot segments in a file name.

## Read before editing

For textual work, inspect only the needed lines:

```bash
sim --output json files read <fileId> --offset 1 --limit 200
```

`files read` extracts text and supports line windows. Use `files get <fileId> --output-file <path>`
when the original bytes are needed. Use `files describe <fileId>` for metadata and sharing status.

Apply one targeted edit with `files edit <fileId> --edit <json|@file>`. Prefer `@path` or `@-` for
multiline content or payloads that are awkward to shell-quote.

### Exact replacement

```json
{
  "mode": "search_replace",
  "search": "old text",
  "content": "new text",
  "replaceAll": false
}
```

Without `replaceAll`, the search must occur exactly once. Set `replaceAll` to true only when every
exact occurrence should change. An empty `content` deletes the matched text.

### Anchor-based edits

Anchors match complete lines after trimming surrounding whitespace. They are not substrings or
regular expressions. `occurrence`, when supplied, is 1-based and selects among repeated valid
matches.

Replace the lines between two retained anchors:

```json
{
  "mode": "replace_between",
  "beforeAnchor": "BEGIN GENERATED",
  "afterAnchor": "END GENERATED",
  "content": "replacement lines",
  "occurrence": 1
}
```

Insert immediately after a retained anchor:

```json
{
  "mode": "insert_after",
  "anchor": "## Changelog",
  "content": "- Added workspace file editing",
  "occurrence": 1
}
```

Delete from the start anchor through the line before the retained end anchor:

```json
{
  "mode": "delete_between",
  "startAnchor": "BEGIN OBSOLETE",
  "endAnchor": "END OBSOLETE",
  "occurrence": 1
}
```

Use `files set-content` only when complete replacement is intentional. A targeted edit preserves
unrelated content and reduces stale-read overwrites. If an edit is rejected because the source
changed concurrently, read the current file and recompute the edit; do not replay the stale write.

## Treat deletion and sharing as explicit effects

File and folder deletion requires `--yes` and is soft-delete where the surface supports restore.
Use `files list --scope archived` or `files folders list --scope archived` to find deleted items,
then restore by exact file id or folder path. A recursive folder delete affects descendants, so use
it only when the requested scope is clear.

Before changing a share, inspect it with `files share get <fileId>`. `files share set` requires a
personal API-key profile. Do not expose share passwords, profile credentials, or unrelated file
content in output.

## Verify and report

After a mutation, read the exact file, folder listing, metadata, or share state that proves the
requested outcome. For edits, verify the affected region and enough surrounding lines to confirm
the anchors and unrelated content remain correct. Report the file id, folder path, and operation
performed, plus any concurrency or authorization error. Do not claim an accepted upload, move, or
edit succeeded without checking the returned result.
