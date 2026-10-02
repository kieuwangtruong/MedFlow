# Credential rotation and Git history cleanup

This repository previously tracked AI `.env` files. One tracked file declares `DATABASE_URL`. No credential value is reproduced in this document. Treat every credential that has ever been stored in those files as exposed.

## Immediate containment

1. Restrict repository visibility and deployment access until rotation is complete if the repository is public or broadly shared.
2. In Neon, create a new password/credential for the application role. Prefer a least-privilege runtime role and a separate migration role where practical.
3. Update `DATABASE_URL` in every affected Render service using the Render environment-variable UI. Do not paste it into `render.yaml`, source code, logs or issue comments.
4. Trigger a controlled backend/AI redeploy and verify readiness plus one non-sensitive smoke flow.
5. Revoke the old Neon credential only after the new deployment is healthy.
6. Rotate any other value that appeared in the historical `.env` files, including service API keys or tokens.

Removing a file from the current Git index does not revoke a credential and does not remove it from earlier commits.

## Verify current-tree remediation

Run from the repository root:

```powershell
git ls-files | Select-String -Pattern '(^|/)\.env($|\.)'
node scripts/security/scan-secrets.mjs
```

Only `.env.example` files should be returned by the first command. The scanner reports file, line and rule identifiers only; it intentionally suppresses matched values.

## History cleanup with git-filter-repo

History rewriting is destructive for commit identities and collaboration. Perform it only after creating a protected backup and coordinating a maintenance window.

```powershell
# Work in a fresh mirror clone, not in a developer working copy.
git clone --mirror https://github.com/kieuwangtruong/MedFlow.git MedFlow-clean.git
Set-Location MedFlow-clean.git

git filter-repo --path ai/peak_hour_prediction/.env --path ai/process_input_data/.env --invert-paths

# Inspect refs and run the secret scanner in a normal fresh clone before pushing.
git push --force --mirror
```

BFG Repo-Cleaner is an alternative when `git filter-repo` is unavailable. Use the same two exact paths and verify all branches and tags before the force-push.

## Safe force-push checklist

- Confirm the new Neon credential is active and the old credential is revoked.
- Archive the pre-rewrite repository in a restricted location for incident response only.
- Pause merges and automated deployments.
- Protect the exact target repository; do not run history-rewrite commands against the team repository by mistake.
- Review rewritten branches/tags and scan a fresh clone.
- Force-push during the agreed window.
- Ask every contributor to delete old clones and clone again. A normal pull can reintroduce removed history.
- Re-enable branch protection and deployments after verification.

## Render update and rollback

Update environment variables service by service. If a new credential fails, restore the previous deployment only while the old credential is still active, diagnose without logging connection strings, then retry rotation. After the old credential is revoked, rollback must use a newly issued credential rather than restoring the exposed value.

## Completion record

Code-side untracking and ignore rules can be verified locally. Credential rotation, revocation and history rewrite require repository/Neon owner authority. Record the operator, date and affected service names in a private incident log; never record credential values.
