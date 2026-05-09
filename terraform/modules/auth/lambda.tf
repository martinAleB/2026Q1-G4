data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/user-auth"
  output_path = "${path.root}/.terraform/tmp/user-auth-lambda.zip"
}

resource "aws_lambda_function" "auth_callback" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-auth-callback"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  runtime = "nodejs20.x"
  
  environment {
    variables = {
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      COGNITO_CLIENT_SECRET = aws_cognito_user_pool_client.main.client_secret
      COGNITO_DOMAIN        = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com"
      FRONTEND_URL          = var.frontend_url
    }
  }
}
