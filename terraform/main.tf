# module "vpc" {
#   source = "./modules/network"

#   vpc_config = {
#     name       = "my-vpc"
#     cidr_block = "10.0.0.0/16"
#     region     = "us-east-1"
#   }

#   subnets_config = [
#     {
#       name              = "public-subnet-1"
#       cidr_block        = "10.0.1.0/24"
#       availability_zone = "us-east-1a"
#       nat_gateway       = true
#     },
#     {
#       name              = "public-subnet-2"
#       cidr_block        = "10.0.2.0/24"
#       availability_zone = "us-east-1b"
#       nat_gateway       = true
#     },
#     {
#       name              = "private-subnet-1"
#       cidr_block        = "10.0.3.0/24"
#       availability_zone = "us-east-1a"
#     },
#     {
#       name              = "private-subnet-2"
#       cidr_block        = "10.0.4.0/24"
#       availability_zone = "us-east-1b"
#     }
#   ]

#   route_tables_config = [
#     {
#       name    = "public-route-table-az-a"
#       subnets = ["public-subnet-1"]
#       routes = [{
#         cidr_block = "0.0.0.0/0"
#         target     = "igw"
#       }]
#     },
#     {
#       name    = "public-route-table-az-b"
#       subnets = ["public-subnet-2"]
#       routes  = []
#     },
#     {
#       name    = "private-route-table-az-a"
#       subnets = ["private-subnet-1"]
#       routes = [
#         {
#           cidr_block = "0.0.0.0/0"
#           target     = "nat"
#         }
#       ]
#     },
#     {
#       name    = "private-route-table-az-b"
#       subnets = ["private-subnet-2"]
#       routes = [
#         {
#           cidr_block = "0.0.0.0/0"
#           target     = "nat"
#         }
#       ]
#     }
#   ]
#   security_groups_config = [
#     {
#       name = "web-sg"
#       inbound = [
#         {
#           protocol           = "tcp"
#           from_port          = 80
#           to_port            = 80
#           cidr_blocks        = ["0.0.0.0/0"]
#           security_group_ref = null
#         }
#       ]
#       outbound = [
#         {
#           protocol           = "tcp"
#           from_port          = 0
#           to_port            = 0
#           cidr_blocks        = ["0.0.0.0/0"]
#           security_group_ref = null
#         }
#       ]
#     }
#   ]
# }

module "auth" {
  source               = "./modules/auth"
  project_name         = "cloud-presti"
  region               = "us-east-1"
  frontend_url         = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

output "auth_user_pool_id" {
  value = module.auth.user_pool_id
}

output "auth_client_id" {
  value = module.auth.client_id
}

output "auth_cognito_domain" {
  value = module.auth.cognito_domain
}

output "auth_api_gateway_endpoint" {
  value = module.auth.api_gateway_endpoint
}

resource "local_file" "frontend_env" {
  filename = "${path.root}/../frontend/.env.local"
  content  = <<-EOT
    VITE_COGNITO_DOMAIN=https://${module.auth.cognito_domain}.auth.us-east-1.amazoncognito.com
    VITE_COGNITO_CLIENT_ID=${module.auth.client_id}
    VITE_API_GATEWAY_CALLBACK_URL=${module.auth.api_gateway_endpoint}/callback
  EOT
}
