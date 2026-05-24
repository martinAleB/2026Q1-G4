output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.vpc.id
}

output "subnet_ids" {
  description = "Map from cidr_block to subnet ID"
  value       = { for cidr, subnet in aws_subnet.subnet : cidr => subnet.id }
}

output "nat_gateway_ids" {
  description = "Map from cidr_block to NAT Gateway ID"
  value       = { for cidr, nat_gw in aws_nat_gateway.nat_gw : cidr => nat_gw.id }
}

output "route_table_ids" {
  description = "Map from name to route table ID"
  value       = { for name, rt in aws_route_table.rt : name => rt.id }
}

output "security_group_ids" {
  description = "Map from name to security group ID"
  value       = { for name, sg in aws_security_group.sg : name => sg.id }
}

output "vpc_endpoint_ids" {
  description = "Map from VPC endpoint name to its ID"
  value       = { for name, ep in aws_vpc_endpoint.endpoint : name => ep.id }
}
