# Preview builds fix (branch `fix-preview-builds`, not merged)

**Change:** `wrangler.jsonc` gains `"previews": {}` (2 additions, 1 deletion: the new line, plus a trailing comma on the line above).

**Why:** Cloudflare's build log for every non-main branch failed with a message that `wrangler preview` needs a `previews` block in the config. Production builds from `main` use a different command and were not affected.

**Evidence so far:** when this was pushed on its own branch, the Cloudflare preview build for that branch passed. That was one observation from the owner's Cloudflare dashboard, not something I can re-run from here, so treat it as "seen passing once" until a second branch also builds.

**Risk:** the new key is empty and only read by preview builds. It does not touch `assets`, routes, or the production deploy command. If Cloudflare ignored it, previews would simply keep failing as they do today.

**Rollback:** revert the single commit (or delete the line and the comma). No data or settings are involved.

**Order of events if approved:** merge to main publishes the website (it is a static-site deploy), so the owner should expect a normal site publish with no visible change.
