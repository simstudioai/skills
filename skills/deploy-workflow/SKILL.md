---
name: deploy-workflow
description: Publish and manage Sim workflows as APIs, chat deployments, or MCP tools through the sim CLI. Use when a tested workflow is ready to expose or deployment state must be inspected or changed; not for building or debugging a draft graph.
---

# Deploy a Sim Workflow

Publish deliberately: identify the requested surface, verify the draft first, and confirm the real
post-deployment state.

## Preflight

- Read the draft and current deployment before changing anything.
- Confirm the draft has no required-field lint issues or unresolved credentials and has completed an
  appropriate manual run.
- If a live deployment already exists, explain whether this publishes a newer draft or changes its
  access configuration.
- Never create, rotate, or reveal an API key unless the user separately asked for key management.

## What a stored version is not

A stored workflow version nulls out `credential`, `oauthCredential`, resource selectors, and
related binding fields. Two consequences:

- A diff against a version document is not a change report. Blocks whose only delta is a nulled
  field show as changed, and selector changes do not show at all - the diff overstates and
  understates simultaneously. Diff live state against live state instead.
- A revert restores the nulled document, stripping every credential and selector in the workflow.
  Never present revert as a safe rollback; the reverted draft needs its bindings re-established
  before it can run.

## Choose one surface

- **API:** for software calling a workflow as a pipeline. Publish with
  `sim --output json workflows deploy <workflowId>` and inspect with `workflows deployment status`.
- **Chat:** for a person using a shareable conversation. Configure the actual output fields, slug,
  title, welcome message, and access policy with `workflows chat publish`; inspect with
  `workflows chat status`. A chat deployment also publishes the workflow API.
- **MCP tool:** for another AI agent calling the workflow as a tool. Inspect or create the target with
  `workflow-mcp-servers list` or `workflow-mcp-servers create`. Deploy the workflow API first when it
  has no active deployment, then publish with `workflow-mcp-servers tools create` using a clear tool
  name, description, and descriptions for real deployed workflow inputs.

Do not choose a surface from convenience. Ask when the intended caller does not make it clear.

## Access invariants

- A protected chat must include the required password or allowed-email list. Fail instead of
  publishing an unusable access policy.
- Use a lowercase hyphenated chat slug.
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

After publishing, read the deployment again. Confirm its active status and version and return the
real URL or MCP connection details from the response; never fabricate them. If the draft remains
ahead of the deployed version, say so.

Undeploy only on an explicit request. Use `workflows undeploy`, `workflows chat unpublish`, or
`workflow-mcp-servers tools delete` for the matching surface, supplying confirmation where the CLI
requires it. Then read the matching deployment status or MCP tool list again to verify it is offline.
