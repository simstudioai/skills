---
name: run-tool
description: Call one Sim integration tool directly through the sim CLI, using credentials Sim already holds. Use for a single action against a connected service — send a message, create an issue, scrape a page; not for multi-step logic or anything scheduled, which belongs in a workflow.
---

# Run a Sim Integration Tool

Sim holds the credentials. Read what the tool declares, bind auth from that declaration, and run it.
Never put a live credential in the command.

## Preflight

- `tools execute` requires a personal API-key profile; a workspace API key is refused.
- Find the tool with `sim --output json tools list --search <term>`, then read it with
  `sim --output json tools get <toolId>`. Never guess a tool id or a parameter name.
- An unversioned name resolves to the newest version visible in the workspace, and the response
  echoes the id that answered. Use that id in the call.

## Bind auth from the declaration, not from habit

`tools get` labels every parameter with a `visibility`, and the label says where its value comes
from:

- `user-or-llm` — you supply it in `--input`.
- `user-only` — you supply it, but pass a reference instead of the secret: `{{VAR_NAME}}` as the
  whole value, resolved server-side. List the available names with
  `sim --output json secrets list`; values are never returned. Any other value is sent verbatim.
- `hidden` — Sim fills it. Never put it in `--input`.

Then bind the credential by the tool's own shape:

- The tool declares `oauth.required` — find the credential with
  `sim --output json credentials list --provider-id <provider>` and pass `--credential-id`.
  Omitting it fails with a message naming the provider.
- `hostedApiKey` is `always`, or `conditional` and this call matches — omit the key entirely; Sim
  supplies its own and bills the workspace.
- Otherwise the tool takes its own `user-only` key parameter; pass a `{{VAR_NAME}}` reference.

## Run and read the outcome

```bash
sim --output json tools execute <toolId> --credential-id <id> --input '{"...": "..."}'
```

`--input` also accepts `@path` or `@-`, which is how a payload too large or too awkward to quote
reaches the command.

A tool that ran and refused exits non-zero with `status: "failed"` and the reason in `error.message`:
the call reached the service and the service declined. Report that reason. A `403` carrying
`error.details.code` `INTEGRATION_NOT_ALLOWED` is a workspace policy decision, not a fixable
argument — say so and stop.

## Invariants

- Never print a resolved secret, an OAuth token, or a profile credential. You hold a credential id
  and a variable name; that is all the call needs.
- Do not retry a failed write blind. A tool call is not idempotent, and a retry can duplicate the
  message, issue, or record the first attempt created.
- Build a workflow instead when the task needs more than one call, branching, or a schedule.
