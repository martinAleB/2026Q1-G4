#!/bin/bash
if [ -z "${STACK_NAME:-}" ]; then
  echo "Missing required env var: STACK_NAME"
  echo "Export it before running this script:"
  echo "  export STACK_NAME=<your-prefix>   # e.g. cloud-presti"
  exit 1
fi

: "${TF_VAR_aws_region:=us-east-1}"
: "${AWS_DEFAULT_REGION:=${TF_VAR_aws_region}}"

: "${TF_VAR_stack_name:=${STACK_NAME}}"
: "${TF_STATE_BUCKET:=${STACK_NAME}-state-bucket}"
: "${TF_LOCK_TABLE:=${STACK_NAME}-lock-table}"
: "${TF_FRONTEND_BUCKET_NAME:=${STACK_NAME}-frontend-bucket}"
: "${TF_VAR_bucket_name:=${TF_FRONTEND_BUCKET_NAME}}"

export TF_VAR_aws_region AWS_DEFAULT_REGION
export TF_VAR_stack_name TF_STATE_BUCKET TF_LOCK_TABLE TF_FRONTEND_BUCKET_NAME TF_VAR_bucket_name
