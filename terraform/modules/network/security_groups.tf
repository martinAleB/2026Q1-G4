locals {
  sg_names = toset([for sg in var.security_groups_config : sg.name])

  flat_inbound_rules = flatten([
    for sg in var.security_groups_config : [
      for idx, rule in sg.inbound : {
        key                = "${sg.name}-inbound-${idx}"
        sg_name            = sg.name
        protocol           = rule.protocol
        from_port          = rule.from_port
        to_port            = rule.to_port
        cidr_blocks        = rule.cidr_blocks
        security_group_ref = rule.security_group_ref
        description        = rule.description
      }
    ]
  ])

  flat_outbound_rules = flatten([
    for sg in var.security_groups_config : [
      for idx, rule in sg.outbound : {
        key                = "${sg.name}-outbound-${idx}"
        sg_name            = sg.name
        protocol           = rule.protocol
        from_port          = rule.from_port
        to_port            = rule.to_port
        cidr_blocks        = rule.cidr_blocks
        security_group_ref = rule.security_group_ref
        description        = rule.description
      }
    ]
  ])
}

resource "aws_security_group" "sg" {
  for_each = { for sg in var.security_groups_config : sg.name => sg }

  name        = "${var.vpc_config.name}-${each.value.name}"
  description = "Security group ${each.value.name} for VPC ${var.vpc_config.name}"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "${var.vpc_config.name}-${each.value.name}"
  }
}

resource "aws_security_group_rule" "ingress" {
  for_each = { for rule in local.flat_inbound_rules : rule.key => rule }

  type              = "ingress"
  security_group_id = aws_security_group.sg[each.value.sg_name].id
  protocol          = each.value.protocol
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  description       = each.value.description

  cidr_blocks = length(each.value.cidr_blocks) > 0 ? each.value.cidr_blocks : null

  source_security_group_id = each.value.security_group_ref != null ? (
    contains(local.sg_names, each.value.security_group_ref)
    ? aws_security_group.sg[each.value.security_group_ref].id
    : each.value.security_group_ref
  ) : null
}

resource "aws_security_group_rule" "egress" {
  for_each = { for rule in local.flat_outbound_rules : rule.key => rule }

  type              = "egress"
  security_group_id = aws_security_group.sg[each.value.sg_name].id
  protocol          = each.value.protocol
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  description       = each.value.description

  cidr_blocks = length(each.value.cidr_blocks) > 0 ? each.value.cidr_blocks : null

  source_security_group_id = each.value.security_group_ref != null ? (
    contains(local.sg_names, each.value.security_group_ref)
    ? aws_security_group.sg[each.value.security_group_ref].id
    : each.value.security_group_ref
  ) : null
}
