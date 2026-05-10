resource "aws_ecr_repository" "flyway" {
  name                 = "cloud-presti-flyway"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_lambda_function" "flyway" {
  function_name = "cloud-presti-flyway"
  role          = data.aws_iam_role.lab_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.flyway.repository_url}:latest"
  timeout       = 300
  memory_size   = 512

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

  lifecycle {
    ignore_changes = [image_uri]
  }

}

output "ecr_flyway_url" {
  value = aws_ecr_repository.flyway.repository_url
}
