locals {
  subnet_name_to_cidr = { for s in var.subnets_config : s.name => s.cidr_block }

  nat_gw_by_az = { for s in var.subnets_config : s.availability_zone => s.cidr_block if s.nat_gateway }

  subnet_az_map = { for s in var.subnets_config : s.cidr_block => s.availability_zone }

  rt_az_map = {
    for rt in var.route_tables_config : rt.name => distinct([
      for subnet_name in rt.subnets : local.subnet_az_map[local.subnet_name_to_cidr[subnet_name]]
    ])
  }

  flat_routes = flatten([
    for rt in var.route_tables_config : [
      for route in rt.routes : {
        route_table_name = rt.name
        cidr_block       = route.cidr_block
        target           = route.target
        az               = local.rt_az_map[rt.name][0]
      }
    ]
  ])

  flat_subnet_associations = flatten([
    for rt in var.route_tables_config : [
      for subnet_name in rt.subnets : {
        route_table_name = rt.name
        subnet_cidr      = local.subnet_name_to_cidr[subnet_name]
      }
    ]
  ])
}

resource "aws_route_table" "rt" {
  for_each = { for rt in var.route_tables_config : rt.name => rt }

  vpc_id = aws_vpc.vpc.id

  tags = {
    Name = "${var.vpc_config.name}-${each.value.name}"
  }
}

resource "aws_route" "route" {
  for_each = { for route in local.flat_routes : "${route.route_table_name}-${route.cidr_block}" => route }

  route_table_id         = aws_route_table.rt[each.value.route_table_name].id
  destination_cidr_block = each.value.cidr_block

  gateway_id     = each.value.target == "igw" ? aws_internet_gateway.igw.id : null
  nat_gateway_id = each.value.target == "nat" ? aws_nat_gateway.nat_gw[local.nat_gw_by_az[each.value.az]].id : null

  lifecycle {
    precondition {
      condition     = each.value.target != "nat" || length(local.rt_az_map[each.value.route_table_name]) == 1
      error_message = "Route table '${each.value.route_table_name}' has subnets in multiple AZs. To use target 'nat', all subnets must be in the same AZ."
    }

    precondition {
      condition     = each.value.target != "nat" || contains(keys(local.nat_gw_by_az), each.value.az)
      error_message = "No NAT Gateway exists in availability zone '${each.value.az}' for route '${each.value.cidr_block}' in route table '${each.value.route_table_name}'."
    }
  }
}

resource "aws_route_table_association" "rta" {
  for_each = { for assoc in local.flat_subnet_associations : "${assoc.route_table_name}-${assoc.subnet_cidr}" => assoc }

  subnet_id      = aws_subnet.subnet[each.value.subnet_cidr].id
  route_table_id = aws_route_table.rt[each.value.route_table_name].id
}
