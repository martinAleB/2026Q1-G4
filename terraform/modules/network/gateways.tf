resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id

  tags = {
    Name = "${var.vpc_config.name}-igw"
  }
}

resource "aws_eip" "nat_eip" {
  for_each = { for subnet in var.subnets_config : subnet.cidr_block => subnet if subnet.nat_gateway }

  domain = "vpc"

  tags = {
    Name = "${var.vpc_config.name}-nat-eip-${each.value.name}"
  }
}

resource "aws_nat_gateway" "nat_gw" {
  for_each = { for subnet in var.subnets_config : subnet.cidr_block => subnet if subnet.nat_gateway }

  allocation_id = aws_eip.nat_eip[each.key].id
  subnet_id     = aws_subnet.subnet[each.key].id

  tags = {
    Name = "${var.vpc_config.name}-nat-${each.value.name}"
  }
}
