resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.us-east-1.secretsmanager"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  subnet_ids = [
    module.vpc.subnet_ids["10.0.2.0/24"],
    module.vpc.subnet_ids["10.0.5.0/24"],
  ]

  security_group_ids = [module.vpc.security_group_ids["secretsmanager-endpoint-sg"]]
}
