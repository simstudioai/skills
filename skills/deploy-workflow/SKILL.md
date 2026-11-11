---
name: deploy-workflow
description: Publish and manage Sim workflows as APIs, chat deployments, or MCP tools through the sim CLI. Use when a tested workflow is ready to expose or deployment state must be inspected or changed; not for building or debugging a draft graph.
---

# Deploy a Sim Workflow

Publish deliberately: identify the requested surface, verify the draft first, and confirm the real
post-deployment state.

## Preflight

- Deploy, activate, rollback, revert, undeploy, and chat publish need workspace admin and an OAuth
  login or personal API key; a workspace key is refused.
- Read the draft and current deployment before changing anything. `workflows deployment status`
  reports `needsRedeployment` (draft differs from live) and the live `webhooks[]` URLs.
- Confirm the draft has no required-field lint issues or unresolved credentials and has completed an
  appropriate manual run.
- Check prior edit responses for skipped operations and dropped inputs, then reread the saved draft
  to verify the intended blocks, connections, and enabled states. Deployment does not establish
  that earlier edits succeeded or that temporary test changes were restored.
- If a live deployment already exists, explain whether this publishes a newer draft or changes its
  access configuration.
- Never create, rotate, or reveal an API key unless the user separately asked for key management.

## Versions, revert, and rollback

- `workflows versions get` returns a sanitized copy: credentials, inline secrets, and opaque
  credential inputs are nulled, so diffing two of those documents both overstates and hides
  changes. Use `workflows versions compare <workflowId> --base <n> --target <n>`, which marks each
  changed value as `value`, `redacted`, or `unset`.
- `workflows revert create <workflowId> <version|active> --yes` overwrites the draft with that
  version's stored graph, credentials included, and cannot be undone. It does not change what
  is live.
- `workflows activate create` and `workflows rollback [--to-version <n>]` change the live version
  for every API and chat consumer and leave the draft alone.

## Choose one surface

- **API:** for software calling a workflow as a pipeline. Publish with
  `sim --output json workflows deploy <workflowId>` and inspect with `workflows deployment status`.
  `workflows deployment update <workflowId> --is-public-api true` lets anyone with the URL run it on
  the workspace's bill; change it only on explicit request.
- **Chat:** for a person using a shareable conversation. Configure the actual output fields, slug,
  title, welcome message, and access policy with `workflows chat publish`; inspect with
  `workflows chat status`. A chat deployment also publishes the workflow API.
- **MCP tool:** for another AI agent calling the workflow as a tool. Inspect or create the target with
  `workflow-mcp-servers list` or `workflow-mcp-servers create`. Deploy the workflow API first when it
  has no active deployment, then publish with `workflow-mcp-servers tools create` using a clear tool
  name, description, and descriptions for real deployed workflow inputs.

Do not choose a surface from convenience. Ask when the intended caller does not make it clear.

## Access invariants

- `chat publish` replaces the whole access policy. Omitting `--auth-type` makes the chat public,
  and omitted password or email settings reset, so republishing a protected chat without its auth
  flags silently opens it. Always resend `--auth-type` (`public`, `password`, `email`, `sso`) with
  `--password` (15-1024 characters) or `--allowed-emails`. Fail instead of publishing an unusable
  or weaker policy.
- The chat `--identifier` slug matches `^[a-z0-9-]+$` and must be free across live deployments.
- Omitting `--output-configs` surfaces no block outputs to visitors.
- Map chat outputs from real block output fields returned by the catalog or a successful run, not
  display labels. MCP generates its schema from deployed workflow inputs; parameter descriptions
  must name those real input fields, and unknown names are ignored.
- Reuse an existing MCP server when it is the intended tool collection; do not create duplicates by
  default.

## Promoting across workspaces with fork sync

Use the `sync-workspaces` skill for portable imports, workspace forks, and push/pull promotion.
That flow owns mapping discovery, preview fingerprints, stable request IDs, and operation polling.

- Sync transfers deployed source versions along a direct fork edge. Push sends current → other;
  pull receives other → current, regardless of which workspace is the child.
- Select resource copies explicitly or map to existing authorized destination resources. Creating a
  destination table is valid when mapping to it; sync does not automatically copy every missing
  resource. Selected table copies include rows, so review environment-specific configuration.
- Import and fork create drafts. Sync deploys eligible admitted snapshots after background work;
  inspect operation and deployment readiness before declaring the target live. Schedules and
  webhooks can begin receiving traffic when their deployment activates.
- Registered selector references are remapped using canonical field modes. Manual values remain
  literal; verify their intended destination instead of assuming they were rebound or that access
  across workspaces is permitted.
- Review trigger URL changes and required configuration. A committed operation can still need
  configuration or have failed follow-up work; an HTTP success alone does not establish readiness.

## Verify and report

Deployment is asynchronous: the deploy response accepts an attempt while the older version can stay
live. Poll `workflows deployment status` until `latestDeploymentAttempt` names the new version with
status `active` (or `failed`). Deploy has no idempotency key, so after a timeout read the status
before deploying again; a blind retry creates another version. Return the real URL or MCP
connection details from the response; never fabricate them. If the draft remains ahead of the
deployed version, say so.

`workflows triggers list <workflowId>` shows the health of each live trigger.
`workflows triggers update <workflowId> <blockId> --enabled false` pauses one, but only until the
next deploy or version activation re-enables every trigger.

Undeploy only on an explicit request. Use `workflows undeploy`, `workflows chat unpublish`, or
`workflow-mcp-servers tools delete` for the matching surface, supplying confirmation where the CLI
requires it. Then read the matching deployment status or MCP tool list again to verify it is offline.
