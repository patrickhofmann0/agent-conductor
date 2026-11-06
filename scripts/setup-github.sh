#!/usr/bin/env bash
# Idempotently configures the GitHub repository: merge settings, labels and
# branch protection. Requires the GitHub CLI (`gh`) authenticated as an admin.
#
# Usage: scripts/setup-github.sh [owner/repo]
set -euo pipefail

REPO="${1:-patrickhofmann0/agent-conductor}"

echo "Configuring $REPO"

echo "- merge settings: squash only, delete branches after merge"
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  >/dev/null

echo "- labels"
create_label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null
}
create_label "conductor" "5319e7" "Start an agent-conductor run for this issue"
create_label "conductor:approved" "0e8a16" "Approve the current agent-conductor gate"
create_label "conductor:needs-human" "d93f0b" "agent-conductor stopped and needs a human"
create_label "guardrails-change" "b60205" "Maintainer approval for changes to guardrail files"

echo "- branch protection on main"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify", "guardrails"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

echo "Done."
