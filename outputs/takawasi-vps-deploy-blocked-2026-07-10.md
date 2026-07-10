# Takawasi Game M3 VPS deploy status

## Passed before remote mutation

- local worktree was clean before the deployment attempt
- `npm ci` and `npm run build` passed
- `git diff --check` and `bash goal-driven-template/tools/check.sh` passed
- personal GitHub `main` accepted the latest local commit `6e20583`
- local desktop full-loop evidence exists at `outputs/takawasi-local-loop-qa-report.json`

## Blocker

- The public staging URL still returns HTTP 404, which matches the pre-deployment state recorded in `docs/deployment/PERSONAL_VPS_STATIC.md`.
- The read-only SSH probe first found the existing personal-VPS login path, but subsequent attempts returned `Connection refused` on port 22.
- A fresh read-only retry at 2026-07-10 09:35 returned the same `Connection refused`; the blocker remains external reachability, not an authentication workaround.
- No release directory, `current` symlink, nginx vhost, reload, or remote file mutation was performed.

## Latest read-only recheck — 2026-07-10

- TCP/22 is now reachable, but the existing local SSH path returned `auth_denied`.
- HTTPS still returns `404`.
- No alternate user, key, credential, host verification bypass, release upload, vhost creation, reload, or remote mutation was attempted.
- The local release SHA is recorded in `outputs/takawasi-vps-preflight-3a4bc68.json`; the remote release gate remains open.

## Resume gate

Retry the existing local SSH path. When the VPS accepts the connection, create a new release named by the full local git SHA, keep prior releases, add the dedicated vhost, run `nginx -t` before reload, then run rendered smoke, live desktop QA, and rollback verification.
