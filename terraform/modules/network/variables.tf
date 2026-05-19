variable "vpc_config" {
  description = "VPC configuration"
  type = object({
    name       = string
    cidr_block = string
    region     = string
  })
}

variable "subnets_config" {
  description = "List of CIDR blocks for the subnets"
  type = list(object({
    name              = string
    cidr_block        = string
    availability_zone = string
    nat_gateway       = optional(bool, false)
  }))
}

variable "route_tables_config" {
  description = "Route tables configuration"
  type = list(object({
    name    = string
    subnets = list(string)
    routes = list(object({
      cidr_block = string
      target     = string
    }))
  }))
  default = []
}

variable "security_groups_config" {
  description = "Security groups configuration"
  type = list(object({
    name = string
    inbound = list(object({
      protocol           = string
      from_port          = number
      to_port            = number
      cidr_blocks        = optional(list(string), [])
      security_group_ref = optional(string, null)
      description        = optional(string, null)
    }))
    outbound = list(object({
      protocol           = string
      from_port          = number
      to_port            = number
      cidr_blocks        = optional(list(string), [])
      security_group_ref = optional(string, null)
      description        = optional(string, null)
    }))
  }))
  default = []
}

variable "vpc_endpoints_config" {
  description = "VPC endpoints to attach to the VPC. For Gateway type, fill route_tables. For Interface type, fill subnets and optionally security_group_refs / private_dns_enabled."
  type = list(object({
    name                = string
    service             = string
    type                = string
    route_tables        = optional(list(string), [])
    subnets             = optional(list(string), [])
    security_group_refs = optional(list(string), [])
    private_dns_enabled = optional(bool, false)
  }))
  default = []
}
