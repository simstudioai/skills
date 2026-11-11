---
name: run-workflow
description: Test and debug Sim workflows through the sim CLI using manual runs, trigger payloads, run-from-block, selected outputs, and run records. Use after authoring or when diagnosing execution; not for graph edits or deployment changes.
---

# Run a Sim Workflow

Choose the execution mode that answers the user's question, then verify the terminal result rather
than treating request acceptance as success.

## Choose saved state or deployment

- Use `sim --output json workflows run <workflowId>` to run the active deployment.
- Add `--manual` to run the current saved draft without deploying it. Manual execution and
  run-from-block need an OAuth login or personal API key with write access; a workspace key is
  refused, and a read-only key gets `403` with `READ_ONLY_API_KEY` on any run.
- Do not deploy a draft merely to test it.

A workflow does not need a Start block for a plain manual run:

```bash
sim --output json workflows run <workflowId> --manual --input @input.json
```

To enter through a runnable trigger, use its block id and provide either explicit input or its
server-derived mock payload:

```bash
sim --output json workflows run <workflowId> \
  --manual --trigger <triggerBlockId> --mock-payload
```

Do not combine `--mock-payload` with `--input`. Do not add `--async` to a manual run.

## Run from a block

Run-from-block resumes a saved draft at one block using persisted upstream state from an exact prior
run:

```bash
sim --output json workflows run <workflowId> \
  --from-block <blockId> --source-run <runId>
```

Do not guess a source run or synthesize upstream outputs. Confirm that the source run belongs to the
workflow and contains the state the selected block needs.

`--stop-after <blockId>` ends the run after that block and fails it if the path skips the block.
With `--from-block` on the same block, it re-runs only that block.

## Long runs and uncertain responses

A long-running draft does not require deployment. Bound a long synchronous run, manual or
deployed, with `--wait-timeout <seconds>`: if the run is still going it continues in the
background, the CLI prints its run record and exits 4, and
`workflows runs wait <runId> --workflow <workflowId>` keeps waiting. `--wait-timeout` cannot be
combined with `--async` or `--follow`, and `--execution-timeout-seconds` requires one of
`--async` or `--wait-timeout`. Use `--follow` when live progress helps; it does not make execution
asynchronous.

`runs wait` exits 0 completed, 1 failed, 2 cancelled, 3 needs input, 4 timed out (default bound
3600 seconds). On 3, read `workflows runs get`: `paused.points[]` carries each pause's `contextId`,
then `workflows runs resume <runId> --workflow <workflowId> --context <contextId> --input @input.json`.
`workflows runs list --workflow <workflowId> --status <status>` finds earlier runs;
`workflows runs cancel` stops one, and a cancelled paused run cannot be resumed.

After a timeout or connection loss, inspect the known run before starting another execution;
external actions may already have occurred. Ordinary runs without `--follow` accept `--run-id`
to choose the identifier before sending. It is not an idempotency key: a claimed ID fails with
`409` `RUN_ID_CONFLICT` rather than replaying the result, and a missing run record does not prove
nothing executed.
Do not automatically retry with a fresh or omitted ID.

## Keep output focused

- Use repeated `--select-output <blockName.field>` values when only specific outputs matter.
- Use `--follow` for a synchronous live run. Add `--include-thinking` or `--include-tool-calls` only
  when the user needs those diagnostics.
- Use `--async` only for deployed runs that should return immediately. Then wait with
  `workflows runs wait` or inspect with `workflows runs get`; do not poll without a stopping bound.
- Check `sim logs get --help` before using optional diagnostic flags. When it lists
  `--no-include-workflow-state`, use that flag to omit the saved graph from a log read. The trace
  still loads; use selected-output reads when only particular results matter.

## Diagnose failures

1. Read the returned run id, status, error, and selected outputs.
2. Inspect the run with
   `sim --output json workflows runs get <runId> --workflow <workflowId> --include-output`.
3. Read the workflow state and confirm the failing block's current inputs and connections.
4. Correct the graph with the build skill. Do not hide a deterministic failure behind retries or a
   different execution mode.

Request acceptance, workflow completion, and successful tool results are different outcomes.
A workflow can complete after handling a failed tool call. Inspect nested tool errors and the
actual output before concluding that research or delivery succeeded; an absent trace is not proof
of success.

Four properties of runs and run records that mislead diagnosis when unknown:

- A run record has a lifecycle. `logs get` returns NOT_FOUND until the run has a log row, which a
  queued run does not yet have, and a completed run can report a `redacting` status for a minute or
  two before its content is readable. Use `workflows runs get` for lifecycle state, and poll with a
  bounded retry before concluding the run vanished.
- Deployment is asynchronous: `workflows deploy` accepts an attempt while the older version stays
  live. Poll `workflows deployment status` until `latestDeploymentAttempt` names the new version
  with status `active` before running to verify it, then confirm the behavior from the outputs.
- Run traces nest: a child workflow's blocks appear inside its parent span, not at the top level.
  Reading only the top level of the span tree silently drops every block a child workflow ran,
  which can be most of the run. Walk the tree recursively before counting blocks or hunting the
  failing one, and judge the block-level trace rather than the wrapper status.
- Cost comes in two units. The CLI's `logs get` reports `cost.total` in dollars, while the
  in-workflow logs block reports the same run's cost in credits. Never compare or store the two as
  one number.

## `{{KEY}}` in run output is usually a mask, not a failure

Only `workflows runs get` and `logs get` return the masked copy, where a resolved secret is written
back as `{{KEY}}` - or `[REDACTED_SECRET]` when it cannot be pinned to one name. Live run output is
never masked: a plain run and a `--follow` stream hit the same endpoint and both carry real values,
so never quote either back.

So a `{{KEY}}` in a masked log is usually a resolved secret rather than a broken reference - but it
is not proof. An unresolved name survives too: JavaScript and Python leave it literal, shell
resolves it to the empty string, and a secret shorter than 8 characters is never masked at all, so
its `{{KEY}}` is always unresolved. `sim --output json secrets list` proves only that a name exists,
not that it resolved in this run. When a block behaves as though the credential were literal text,
check the spelling there first - but never "fix" a working reference by rewriting it into
`environmentVariables.KEY` or hardcoding a literal.

Report which mode ran, the terminal status, and the relevant output or error. Include the run id when
the selected execution mode returns one; `--follow` streams omit it. Never print profile credentials
or raw secrets from block inputs.
