# Takawasi Game - Personal VPS Static Deployment

Last verified: 2026-07-10

## Scope

Deploy the Vite static build to the owner's personal infrastructure. This runbook contains no credentials; authentication comes from the existing local SSH configuration/keychain.

## Targets

- GitHub source: `git@github.com:oiwatakashi-alt/takawasi-game-ugcw-ppoi.git`
- Branch: `main`
- Public staging host: `https://game.takawasi-social.com/`
- VPS deployment root: `/var/www/subdomains/game`
- Release layout: `/var/www/subdomains/game/releases/<git-sha>/`
- Active release: `/var/www/subdomains/game/current` symlink

Read-only checks on 2026-07-10 proved that the personal repository exists at `main=2fa693e`, DNS for the staging host resolves to the personal VPS, nginx is running, the host is not yet an explicit `server_name`, and the HTTPS request currently reaches the VPS but returns `404`.

## Non-Goals

- No AWS, App Runner, Medixus organization, company account, backend, database, payment, or external production connector.
- Do not copy `/Users/oiwa/Desktop/接続情報.md`, tokens, passwords, API keys, credential files, or private keys into the repo or deployment tree.
- Do not deploy from an uncommitted worktree.

## First-Deployment Gate

1. `git status --short` is empty and the intended commit is pushed to the personal GitHub repo.
2. `npm ci` and `npm run build` pass.
3. Local desktop browser QA completes Theater -> Camp -> Deployment -> Battle -> After Action -> next turn with console error 0 and broken image 0.
4. Upload `dist/` to a new release directory named by the full git SHA. Never overwrite an older release.
5. Create an explicit nginx HTTPS vhost for `game.takawasi-social.com` with `root /var/www/subdomains/game/current` and `try_files $uri $uri/ /index.html`.
6. Run `nginx -t` before reload. Do not reload on failure.
7. Atomically switch `current` to the new release, reload nginx, and verify the rendered Takawasi Game title/route content rather than accepting status 200 alone.
8. Run desktop browser QA against the live URL and record the release SHA and evidence under `outputs/`.

## Rollback

Point `current` back to the previous release symlink, run `nginx -t`, reload nginx, and repeat the rendered-content smoke. Retain at least the previous two releases until the next release passes live QA.

## Current Status

- Repository route: verified; local `origin` corrected and migration commit `05e8fc1` pushed to personal `main`.
- DNS/VPS reachability: verified.
- Explicit nginx vhost and deployment tree: not created.
- Live game deployment: not started.
