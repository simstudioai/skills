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
  run-from-block require a personal API-key profile; a workspace API key is not permitted.
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

## Runs longer than about a minute

A manual run holds its HTTP connection open for the entire execution, and `--manual` refuses
`--async`. On hosted deployments the fronting load balancer drops idle connections after roughly a
minute (observed; re-verify on the current deployment), and a dropped connection cancels the run.
The failure surfaces as a transport error such as `Could not reach <origin>: fetch failed`, not as
a timeout, so it reads like network flakiness. It is not: retrying the same synchronous run fails
the same way, and a sequence of such attempts corrupts the evidence - a deterministic workflow
starts looking nondeterministic because most of its recorded attempts are transport casualties.

When a workflow can plausibly exceed a minute, deploy it and run `--async`, then wait with
`workflows runs wait` or poll `workflows runs get` with a stopping bound. Reserve synchronous
manual runs for graphs that finish quickly.

## Keep output focused

- Use repeated `--select-output <blockName.field>` values when only specific outputs matter.
- Use `--follow` for a synchronous live run. Add `--include-thinking` or `--include-tool-calls` only
  when the user needs those diagnostics.
- Use `--async` only for deployed runs that should return immediately. Then wait with
  `workflows runs wait` or inspect with `workflows runs get`; do not poll without a stopping bound.

## Diagnose failures

1. Read the returned run id, status, error, and selected outputs.
2. Inspect the run with
   `sim --output json workflows runs get <runId> --workflow <workflowId> --include-output`.
3. Read the workflow state and confirm the failing block's current inputs and connections.
4. Correct the graph with the build skill. Do not hide a deterministic failure behind retries or a
   different execution mode.

Four properties of runs and run records that mislead diagnosis when unknown:

- A run record has a lifecycle. `logs get` returns NOT_FOUND for a run that is still in flight and
  for one that was cancelled, and a completed run can report a `redacting` status for a minute or
  two before its content is readable. Poll with a bounded retry before concluding the run vanished.
- Firing a run immediately after `workflows deploy` reports the new version active can still
  execute the previous deployment, silently. When a run exists to verify a deploy, confirm the
  executed behavior from its outputs rather than trusting the deploy response, and re-run if the
  outputs match the old version.
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
