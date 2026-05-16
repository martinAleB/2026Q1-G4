resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.us-east-1.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids = [
    module.vpc.route_table_ids["private-rt-az-a"],
    module.vpc.route_table_ids["private-rt-az-b"],
  ]
}

resource "aws_security_group" "interface_endpoints" {
  name   = "interface-endpoints-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
}

resource "aws_vpc_endpoint" "sqs" {
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.us-east-1.sqs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [module.vpc.subnet_ids["10.0.2.0/24"], module.vpc.subnet_ids["10.0.5.0/24"]]
  security_group_ids  = [aws_security_group.interface_endpoints.id]
  private_dns_enabled = true
}
