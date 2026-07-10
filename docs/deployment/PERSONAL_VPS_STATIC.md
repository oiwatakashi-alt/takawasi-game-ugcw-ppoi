# Takawasi Game - Personal VPS Static Deployment

Last verified: 2026-07-10 (current release rechecked)

## Scope

Deploy the Vite static build to the owner's personal infrastructure. This runbook contains no credentials; authentication comes from the existing local SSH configuration/keychain.

## Targets

- GitHub source: `git@github.com:oiwatakashi-alt/takawasi-game-ugcw-ppoi.git`
- Branch: `main`
- Public staging host: `https://game.takawasi-social.com/`
- VPS deployment root: `/var/www/subdomains/game`
- Release layout: `/var/www/subdomains/game/releases/<git-sha>/`
- Active release: `/var/www/subdomains/game/current` symlink

Historical preflight before first deployment proved that the personal repository exists at `main=2fa693e`, DNS for the staging host resolves to the personal VPS, nginx is running, and the HTTPS request reached the VPS but returned `404`. That preflight state is superseded by the release record below.

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

- Repository route: verified; local `origin` is the personal repository and current documentation/audit commits are pushed to personal `main`.
- Current release: `f058545e6597b5c966184b9198320a3627677f5b`, deployed as a SHA-named release with `current` symlink.
- Deployment evidence: `outputs/takawasi-vps-deploy-f058545.json` records 92-file hash match, dedicated vhost, `nginx -t`, reload, rendered smoke, and rollback rehearsal.
- Live QA evidence: `outputs/takawasi-vps-live-f058545-*.png` records 1280x720 Theater→Camp→Deployment→Battle→After Action→next-turn flow; latest read-only recheck is `outputs/takawasi-vps-live-recheck-2026-07-10.md`.
- Live status: `https://game.takawasi-social.com/` is playable. Latest Theater recheck: console errors 0, broken images 0, horizontal overflow false, primary action top 304px.
