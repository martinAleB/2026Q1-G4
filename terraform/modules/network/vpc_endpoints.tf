resource "aws_vpc_endpoint" "endpoint" {
  for_each = { for ep in var.vpc_endpoints_config : ep.name => ep }

  vpc_id            = aws_vpc.vpc.id
  service_name      = each.value.service
  vpc_endpoint_type = each.value.type

  route_table_ids = each.value.type == "Gateway" ? [
    for rt_name in each.value.route_tables : aws_route_table.rt[rt_name].id
  ] : null

  subnet_ids = each.value.type == "Interface" ? [
    for subnet_cidr in each.value.subnets : aws_subnet.subnet[subnet_cidr].id
  ] : null

  security_group_ids = each.value.type == "Interface" ? [
    for sg_name in each.value.security_group_refs : aws_security_group.sg[sg_name].id
  ] : null

  private_dns_enabled = each.value.type == "Interface" ? each.value.private_dns_enabled : null

  tags = {
    Name = "${var.vpc_config.name}-${each.value.name}-endpoint"
  }

  lifecycle {
    precondition {
      condition     = contains(["Gateway", "Interface"], each.value.type)
      error_message = "VPC endpoint '${each.value.name}' has invalid type '${each.value.type}'. Must be 'Gateway' or 'Interface'."
    }

    precondition {
      condition     = each.value.type != "Gateway" || length(each.value.route_tables) > 0
      error_message = "VPC endpoint '${each.value.name}' is of type 'Gateway' and requires at least one entry in 'route_tables'."
    }

    precondition {
      condition     = each.value.type != "Interface" || length(each.value.subnets) > 0
      error_message = "VPC endpoint '${each.value.name}' is of type 'Interface' and requires at least one entry in 'subnets'."
    }
  }
}
