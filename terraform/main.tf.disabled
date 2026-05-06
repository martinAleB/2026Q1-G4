module "vpc" {
  source = "./modules/network"

  vpc_config = {
    name       = "my-vpc"
    cidr_block = "10.0.0.0/16"
    region     = "us-east-1"
  }

  subnets_config = [
    {
      name              = "public-subnet-1"
      cidr_block        = "10.0.1.0/24"
      availability_zone = "us-east-1a"
      nat_gateway       = true
    },
    {
      name              = "public-subnet-2"
      cidr_block        = "10.0.2.0/24"
      availability_zone = "us-east-1b"
      nat_gateway       = true
    },
    {
      name              = "private-subnet-1"
      cidr_block        = "10.0.3.0/24"
      availability_zone = "us-east-1a"
    },
    {
      name              = "private-subnet-2"
      cidr_block        = "10.0.4.0/24"
      availability_zone = "us-east-1b"
    }
  ]

  route_tables_config = [
    {
      name    = "public-route-table-az-a"
      subnets = ["public-subnet-1"]
      routes = [{
        cidr_block = "0.0.0.0/0"
        target     = "igw"
      }]
    },
    {
      name    = "public-route-table-az-b"
      subnets = ["public-subnet-2"]
      routes  = []
    },
    {
      name    = "private-route-table-az-a"
      subnets = ["private-subnet-1"]
      routes = [
        {
          cidr_block = "0.0.0.0/0"
          target     = "nat"
        }
      ]
    },
    {
      name    = "private-route-table-az-b"
      subnets = ["private-subnet-2"]
      routes = [
        {
          cidr_block = "0.0.0.0/0"
          target     = "nat"
        }
      ]
    }
  ]
  security_groups_config = [
    {
      name = "web-sg"
      inbound = [
        {
          protocol           = "tcp"
          from_port          = 80
          to_port            = 80
          cidr_blocks        = ["0.0.0.0/0"]
          security_group_ref = null
        }
      ]
      outbound = [
        {
          protocol           = "tcp"
          from_port          = 0
          to_port            = 0
          cidr_blocks        = ["0.0.0.0/0"]
          security_group_ref = null
        }
      ]
    }
  ]
}
