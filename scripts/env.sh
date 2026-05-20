#!/bin/bash
# Derives all deployment-specific env vars from a single STACK_NAME.
#
# Source this file from any script that needs TF_VAR_stack_name,
# TF_STATE_BUCKET, TF_LOCK_TABLE, TF_FRONTEND_BUCKET_NAME or
# TF_VAR_bucket_name:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
#
# Each developer of the team exports STACK_NAME (e.g. tincho-presti) so that
# parallel deploys to the same AWS account do not collide on globally-unique
# resource names. Individual overrides via TF_STATE_BUCKET etc are honored if
# already exported.

if [ -z "$STACK_NAME" ]; then
  echo "Missing required env var: STACK_NAME"
  echo "Export it before running this script:"
  echo "  export STACK_NAME=<your-prefix>   # e.g. tincho-presti"
  exit 1
fi

# Use ":=" so explicit overrides win.
: "${TF_VAR_stack_name:=${STACK_NAME}}"
: "${TF_STATE_BUCKET:=${STACK_NAME}-state-bucket}"
: "${TF_LOCK_TABLE:=${STACK_NAME}-lock-table}"
: "${TF_FRONTEND_BUCKET_NAME:=${STACK_NAME}-frontend-bucket}"
: "${TF_VAR_bucket_name:=${TF_FRONTEND_BUCKET_NAME}}"

export TF_VAR_stack_name TF_STATE_BUCKET TF_LOCK_TABLE TF_FRONTEND_BUCKET_NAME TF_VAR_bucket_name
