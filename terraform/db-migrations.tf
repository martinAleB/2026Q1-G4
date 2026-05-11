data "archive_file" "migrations" {
  type        = "zip"
  source_dir  = "${path.module}/../db"
  output_path = "${path.module}/../db/dist/migrations.zip"
  excludes    = ["dist"]
}

resource "aws_lambda_function" "db_migrations" {
  function_name    = "cloud-presti-db-migrations"
  role             = data.aws_iam_role.lab_role.arn
  package_type     = "Zip"
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.migrations.output_path
  source_code_hash = data.archive_file.migrations.output_base64sha256
  timeout          = 300
  memory_size      = 256

  vpc_config {
    subnet_ids = [
      module.vpc.subnet_ids["10.0.2.0/24"],
      module.vpc.subnet_ids["10.0.5.0/24"],
    ]
    security_group_ids = [module.vpc.security_group_ids["lambda-sg"]]
  }

  environment {
    variables = {
      DB_HOST    = aws_db_proxy.main.endpoint
      DB_PORT    = "5432"
      DB_NAME    = "cloudpresti"
      SECRET_ARN = module.rds.db_instance_master_user_secret_arn
    }
  }
}
