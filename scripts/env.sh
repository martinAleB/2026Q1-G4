#!/bin/bash
# Derives all deployment-specific env vars from a single STACK_NAME.
#
# Source this file from any script that needs TF_VAR_stack_name,
# TF_VAR_aws_region, AWS_DEFAULT_REGION, TF_STATE_BUCKET, TF_LOCK_TABLE,
# TF_FRONTEND_BUCKET_NAME or TF_VAR_bucket_name:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
#
# Each developer of the team exports STACK_NAME (e.g. tincho-presti) so that
# parallel deploys to the same AWS account do not collide on globally-unique
# resource names. The AWS region defaults to us-east-1 (lab restriction) but
# can be overridden by exporting TF_VAR_aws_region. Individual overrides via
# TF_STATE_BUCKET etc are also honored if already exported.

# `${VAR:-}` para que el check sea compatible con `set -u` en el script
# que sourcea este archivo: sin el `:-` la expansión de una STACK_NAME no
# definida romperia antes de llegar al test.
if [ -z "${STACK_NAME:-}" ]; then
  echo "Missing required env var: STACK_NAME"
  echo "Export it before running this script:"
  echo "  export STACK_NAME=<your-prefix>   # e.g. tincho-presti"
  exit 1
fi

# Region defaults: ":=" so explicit user overrides win, and AWS_DEFAULT_REGION
# is derived from TF_VAR_aws_region so the AWS CLI commands the user runs
# (`aws s3 sync`, `aws logs tail`, etc.) use the same region as Terraform
# without needing to be exported separately.
: "${TF_VAR_aws_region:=us-east-1}"
: "${AWS_DEFAULT_REGION:=${TF_VAR_aws_region}}"

: "${TF_VAR_stack_name:=${STACK_NAME}}"
: "${TF_STATE_BUCKET:=${STACK_NAME}-state-bucket}"
: "${TF_LOCK_TABLE:=${STACK_NAME}-lock-table}"
: "${TF_FRONTEND_BUCKET_NAME:=${STACK_NAME}-frontend-bucket}"
: "${TF_VAR_bucket_name:=${TF_FRONTEND_BUCKET_NAME}}"

export TF_VAR_aws_region AWS_DEFAULT_REGION
export TF_VAR_stack_name TF_STATE_BUCKET TF_LOCK_TABLE TF_FRONTEND_BUCKET_NAME TF_VAR_bucket_name
