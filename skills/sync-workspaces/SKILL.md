---
name: sync-workspaces
description: Import portable Sim workflow JSON with destination bindings, create workspace forks, or push and pull deployed workflows along a fork edge through the sim CLI. Use for environment promotion, mapping and selector discovery, preview/apply retries, and operation readiness; not for authoring a new graph or ordinary deployment.
---

# Import and Sync Sim Workflows

Use a reviewed preview, explicit destination bindings, and a durable request ID. Verify the returned
operation; sync also requires target deployment readiness. Imports and forks complete as drafts.

## Establish scope

- Use the user's profile, API origin, and explicit workspace. Inspect context before selecting an
  environment; never silently change accounts. Do not print or store authentication secrets.
- Check `sim workflows import-preview --help` or `sim workspaces push-preview --help` first. These
  commands require a CLI and server with the v2 sync feature. If unavailable, report the missing
  capability and required upgrade; do not substitute private browser endpoints.
- Fork creation requires source admin. Sync and mapping changes require admin on both workspaces.
  Fork administration accepts personal API keys or OAuth, not workspace keys. Imports retain their
  existing workflow-write permissions; credential binding still requires an eligible acting user.
- Inspect `workspaces fork-availability` before forking. Enterprise/self-hosting and workspace
  creation policies still apply. OAuth scopes and permission groups can further restrict access.
- Use `--output json`. Single-resource CLI results are unwrapped objects; paged results contain
  `data` and `nextCursor`. Raw v2 HTTP single-resource responses wrap the object in `data`.

## Choose the operation

| Intent | Commands | Result |
| --- | --- | --- |
| Import workflow JSON into an authorized destination | `workflows export`, `import-preview`, `import` | New undeployed draft with regenerated graph IDs |
| Create a child environment | `workspaces fork-preview`, `fork` | Child workspace with eligible deployed source workflows copied as drafts |
| Send current workspace changes to its direct fork neighbor | `workspaces push-preview`, `push` | Replace eligible target workflows from deployed source versions |
| Receive changes from a direct fork neighbor | `workspaces pull-preview`, `pull` | Same sync with the other workspace as source |

Push always means current → other; pull means other → current, on either side of the parent/child
edge. Inspect `workspaces lineage` and `children`; do not infer direction from the word child.
Arbitrary workspace transfers and draft sync are outside this flow.

## Portable import

Export with reference metadata and preview in the destination:

```sh
sim --profile source --workspace "$SOURCE_WORKSPACE" --output json \
  workflows export "$WORKFLOW_ID" --include-references > workflow.json
sim --profile destination --workspace "$DESTINATION_WORKSPACE" --output json \
  workflows import-preview --workflow @workflow.json > preview.json
```

Default export remains sanitized without reference metadata. `--include-references` records
registered non-secret source IDs and every block/field occurrence alongside the sanitized graph.
Treat imported IDs and provenance as untrusted labels, not authorization to read a source workspace.

Read `unresolvedBindings`, `unresolvedConfiguration`, and target-discovery instructions. Discover
destination credentials, tables, files, sandboxes, and other resources through their existing CLI
commands. Candidate matches are suggestions; verify provider, resource type, and parent resource.
Missing OAuth connections can require human provider authorization; report that requirement rather
than inventing a connection or substituting a different user's credential.

Import resource mappings use `kind`, `sourceId`, and `targetId`:

```json
[
  { "kind": "credential", "sourceId": "source-connection", "targetId": "destination-connection" },
  { "kind": "sandbox", "sourceId": "source-sandbox", "targetId": "destination-sandbox" }
]
```

For older exports, `--bindings` addresses a specific registered source occurrence. For example:

```json
[
  { "kind": "sandbox", "blockId": "source-function", "subBlockKey": "sandboxId", "targetId": "destination-sandbox" }
]
```

`valuePath` defaults to `[]` and `encoding` to `scalar`. Use preview/manifest occurrence paths for
nested or multi-value fields; do not guess them. Conflicting mappings and bindings are rejected.
Import dependent values use `{blockId, subBlockKey, value}`, such as
`{"blockId":"source-agent","subBlockKey":"tools[0].folder","value":"destination-label"}`.
Keep the original source IDs and tool indexes until apply returns `idMap`.

Save the exact input files and a client-generated stable request ID before applying:

```sh
sim --profile destination --workspace "$DESTINATION_WORKSPACE" --output json \
  workflows import-preview --workflow @workflow.json \
  --mappings @mappings.json --dependent-values @values.json > preview.json
sim --profile destination --workspace "$DESTINATION_WORKSPACE" --output json \
  workflows import --workflow @workflow.json \
  --mappings @mappings.json --dependent-values @values.json \
  --preview-fingerprint "$(jq -r .previewFingerprint preview.json)" \
  --request-id "$REQUEST_ID" --wait
```

Include the same name, folder, bindings, and other choices on both requests. JSON flags accept
`@file` and `@-` for stdin; only one input can consume stdin. Mapped import creates nothing while
required bindings remain unresolved. It commits the draft, graph, variables, inline custom tools,
and receipt together. Mappings are local to this request; importing does not create a workflow
correspondence on a fork edge. Plain imports without mapping options
retain legacy behavior; use preview/apply for automation that needs binding guarantees.

## Fork and sync choices

Inspect `workspaces fork-resources`, then preview with explicit copy selections. A fork's
`--copy` selects source resources; sync uses `--copy-resources`. Consult command help for each
shape: fork file selections are workspace file IDs, while sync file selections are storage keys.
Copying is opt-in. Selected table copies include rows and selected knowledge bases include content;
account for environment-specific configuration before enabling the destination.

Existing destination resources can be mapped instead of copied. Sync mapping entries use
`{resourceType, sourceId, targetId}`; they differ from import's `kind` entries. In particular,
portable `credential` corresponds to sync `oauth_credential` or `service_account_credential`.
Verify the actual credential type through resource discovery. A mapping inspection row also has
`id`; project it before reuse with `jq '.data | map({resourceType,sourceId,targetId})'`. Follow all
pages first. Newly referenced resources may have no persisted mapping row yet.

Previews evaluate inline mappings without saving them. Accepted inline sync mappings persist on
the canonical edge in the same transaction as sync; a refusal before commit saves neither.
Dependent sync values use `{sourceWorkflowId, sourceBlockId, subBlockKey, value}`. Never use fresh
target IDs from preview as override identities. Omitted overrides reuse saved sync choices; values
that exist only in a target draft are not saved choices. A supplied `dependentValues` array replaces
the saved choices for affected workflows; `[]` clears them. Start from every preview configuration
field and its `currentValue`, edit the intended selections, and submit the complete set of choices
to retain, rather than only the changed fields.

For every dependent field, use its returned selector key, context, and `discoveryWorkspaceId`:

```sh
sim --profile destination --workspace "$DISCOVERY_WORKSPACE" --output json \
  selectors list --selector-key gmail.labels \
  --context '{"oauthCredential":"destination-connection"}'
```

The discovery workspace is the source when the parent resource will be copied, and the destination
when using an existing mapping. Use a profile authorized for that workspace. Follow `nextCursor`,
inspect truncation metadata, and use `selectors get --help` to verify a particular option. A clipped
list does not prove an option is absent. Resolve dependent chains in order, re-previewing with the
new choices. Use exactly the returned context for MCP tool discovery as well.

```sh
sim --profile destination --workspace "$DESTINATION_WORKSPACE" --output json \
  workspaces pull-preview --other-workspace-id "$SOURCE_WORKSPACE" \
  --mappings @sync-mappings.json --dependent-values @sync-values.json > sync-preview.json
sim --profile destination --workspace "$DESTINATION_WORKSPACE" --output json \
  workspaces pull --other-workspace-id "$SOURCE_WORKSPACE" \
  --mappings @sync-mappings.json --dependent-values @sync-values.json \
  --preview-fingerprint "$(jq -r .previewFingerprint sync-preview.json)" \
  --request-id "$SYNC_REQUEST_ID" --yes --wait
```

Use `--yes` within the user's authorized destructive sync scope. Review replacements, exclusions,
resource selections, required configuration, and trigger URL changes before apply. If preview offers
trigger adoption choices, use its stable source workflow/block identities and offered paths; never
invent a path. Sync `ready` indicates commit readiness, not a live deployment. Scheduled or webhook
workflows can begin receiving traffic once admitted deployments activate.

## Completion and recovery

- Save `operationId`, `requestId`, and the receipt's `workspaceId`. Import receipts belong to the
  destination; fork and push/pull receipts belong to the workspace on which the command was invoked.
  Poll that scope even when the created child or sync target is a different workspace.
- `applied: true` means the transaction committed, including when later copy/deployment work fails.
  Use `workspaces operations get <operationId>` or `wait <operationId> --wait-timeout 300` to refresh
  readiness. Operation lists are stored snapshots; filter with `--request-id` to recover a lost ID.
- Require terminal readiness and inspect issues/trigger URL changes before declaring the environment
  ready. Completed-with-warnings exits 0 but still needs review. Required configuration exits 3,
  failed completion exits 1, and wait timeout exits 4. Timeout diagnostics retain reconciliation IDs.
- After an uncertain response, retry identical inputs with the original request ID, or poll the
  existing operation. Never retry an uncertain mutation with a fresh ID. Same ID with changed input
  returns 409. Authorize access again before reconciliation; a stored receipt is not an auth bypass.
- A stale preview with no committed operation needs a fresh preview and a new request ID for the
  revised inputs. Resolve structured 409 issues; do not loop blindly or remove safety flags.
- Sync transfers deployed source versions. Merely undeploying a source does not archive its target;
  deleting a mapped source can. Respect explicit sync exclusions.
- Rollback restores the latest target sync from prior deployed versions. It does not recover
  arbitrary prior drafts or remove every copied resource. Use rollback/unlink/exclusion controls
  only for the requested recovery scope and verify their result.

For a new imported draft, use the `run-workflow` skill to test it and `deploy-workflow` only when
publication is requested. Never copy secret values, signed URLs, arbitrary headers, or opaque
credential payloads between environments to make a binding pass.
