# Sim Skills

Official skills-only `sim` plugin for building workflows and operating Sim resources through the
Sim CLI.

## Install

Install from the repository with the standard Agent Skills installer:

```bash
bunx skills add simstudioai/skills --global
```

Install one skill for Codex without prompting:

```bash
bunx skills add simstudioai/skills \
  --skill build-workflow \
  --agent codex \
  --global \
  --yes
```

Once published, the npm package provides a shorter interactive installer:

```bash
bunx sim-skills
```

Install one skill globally for a specific agent:

```bash
bunx sim-skills --skill build-workflow --agent codex --global --yes
```

List the bundled skills without installing them:

```bash
bunx sim-skills --list
```

All options after `sim-skills` are forwarded to the standard Agent Skills installer. `install` and
`add` are optional aliases, so `bunx sim-skills install --list` is equivalent to the last example.

The repository and npm package roots are also native plugin roots. Their `.codex-plugin/` and `.claude-plugin/`
manifests both declare `sim` as the plugin namespace, and `skills/` contains the shared skills.
This allows plugin marketplaces to use either source without a subdirectory selector or
install-time build step.

A Codex marketplace can install the native plugin directly from npm:

```json
{
  "name": "sim",
  "source": {
    "source": "npm",
    "package": "sim-skills",
    "version": "latest",
    "registry": "https://registry.npmjs.org"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

## Namespace

Native plugin installs expose the skills under the `sim` namespace:

- `sim:build-workflow`
- `sim:run-workflow`
- `sim:deploy-workflow`
- `sim:files`
- `sim:table`
- `sim:knowledge-base`
- `sim:run-tool`

Direct installs through `bunx sim-skills` install the selected skills without the plugin prefix.

## Included skills

- `build-workflow` — discover blocks and author a draft graph with atomic workflow operations.
- `run-workflow` — test saved state, exercise triggers, resume from a block, and diagnose runs.
- `deploy-workflow` — publish and manage workflows as APIs, chats, or MCP tools.
- `files` — organize workspace files and folders, read and search text, and apply targeted edits.
- `table` — design typed tables, load and query rows, import data, and run workflow groups.
- `knowledge-base` — ingest and index documents, configure connectors and tags, and verify retrieval.
- `run-tool` — call one integration tool directly with Sim-managed credentials.

The skills assume the `sim` CLI is installed and authenticated. They never store or print API keys.
