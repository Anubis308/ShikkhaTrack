# Blocks Agent + Workflow setup for ShikkhaTrack AI

ShikkhaTrack does not call OpenAI. Classify, draft-reply, and at-risk scoring POST a `{ "prompt": "..." }` body to a **Blocks Logic** webhook. That workflow has two nodes: **Webhook** trigger → **Agent** action. The Agent node's output is returned in the webhook HTTP response.

There is no CLI command for this. Use the Blocks console for the ShikkhaTrack tenant (`Dbe0eefff372a4ed3a61e3eeb8e0d454f`).

## Live production URL

```
https://logic.seliseblocks.com/api/Workflow/webhook/Dbe0eefff372a4ed3a61e3eeb8e0d454f/7e95943fcff74634897b8e2a4c5f81ef/8cb1b6f4651f4c058bb375a33e576196
```

Paste that into `VITE_AI_WORKFLOW_WEBHOOK_URL` (already set in `.env.example`). The client also sends `x-blocks-key: Dbe0eefff372a4ed3a61e3eeb8e0d454f`. Trigger `authType` is `none` for now.

Example:

```bash
curl --location 'https://logic.seliseblocks.com/api/Workflow/webhook/Dbe0eefff372a4ed3a61e3eeb8e0d454f/7e95943fcff74634897b8e2a4c5f81ef/8cb1b6f4651f4c058bb375a33e576196' \
  --header 'Content-Type: application/json' \
  --header 'x-blocks-key: Dbe0eefff372a4ed3a61e3eeb8e0d454f' \
  --data '{"prompt":"who are you"}'
```

Expected shape:

```json
{
  "executionId": "<id>",
  "status": "Completed",
  "data": "<agent reply as a string>"
}
```

For classify / draft / at-risk, `data` must be a JSON object as a string (the app `JSON.parse`s it).

## Recreate the Agent

1. Open Blocks Agents for this tenant.
2. Add Agent, name e.g. `ShikkhaTrack Assistant`.
3. Optional system prompt (not required; the app already puts the task + JSON schema in `prompt`):

   > You are ShikkhaTrack's support-desk assistant for a Mirpur coaching centre. Every incoming message already contains its own task instructions and the JSON schema you must return. Always reply with ONLY a single valid JSON object matching the schema requested in the message — no prose, no markdown code fences, no extra keys.

4. Pick a cheap/fast chat model. Save so the agent has a `widget_id`.

## Recreate the Workflow

1. Open Blocks Logic → **Add Workflow**, name e.g. `ShikkhaTrack AI Bridge`.
2. **Webhook** trigger:
   - HTTP Method: POST (fixed)
   - Authentication Type: **None**
   - Response: **After Last Node Completion**
   - Response Data: **First Entry**
3. **Agent** action: select the agent above. Input: `{{$json.prompt}}` (use the inspector picker if the live syntax differs).
4. Connect Webhook → Agent. Save, then **Publish**.
5. Webhook inspector → **Production** tab → copy **Deprecated Webhook URL** (path includes the tenant id). Put it in `VITE_AI_WORKFLOW_WEBHOOK_URL`.

Unpublished workflows only serve `/webhook-test/...` while the editor is listening. Production needs **Publish**.

## Auth later

When you switch the trigger off `none`, add `Authorization: Bearer <token>` in `src/features/ai/openaiClient.ts` (`chatJson`). `x-blocks-key` is already sent.
