# Terraform Modules Reference

Complete reference for all Terraform modules used in Dejafoo infrastructure.

## Module Structure

Dejafoo uses a modular Terraform structure with separate modules for each AWS service:

```
infra/
├── phase1/                # Phase 1 modules (no SSL)
│   └── modules/
│       ├── apigateway/    # API Gateway without custom domain
│       ├── lambda/        # Lambda function
│       ├── s3/            # S3 bucket for caching
│       └── route53/       # Route53 zone only (no SSL)
└── phase2/                # Phase 2 modules (with SSL)
    └── modules/
        ├── apigateway/    # API Gateway with custom domain
        ├── lambda/        # Lambda function (same as Phase 1)
        ├── s3/            # S3 bucket (same as Phase 1)
        └── route53/       # Route53 with SSL certificates
```

## Phase 1 Modules

### API Gateway Module

**Path**: `infra/phase1/modules/apigateway/`

Creates API Gateway without custom domain configuration.

**Variables**:
- `environment` (string): Environment name
- `lambda_function_name` (string): Lambda function name
- `lambda_invoke_arn` (string): Lambda invoke ARN

**Outputs**:
- `api_gateway_url` (string): API Gateway URL
- `api_gateway_id` (string): API Gateway ID

**Resources**:
- `aws_api_gateway_rest_api`
- `aws_api_gateway_resource`
- `aws_api_gateway_method`
- `aws_api_gateway_integration`
- `aws_api_gateway_deployment`

### Lambda Module

**Path**: `infra/phase1/modules/lambda/`

Creates Lambda function with IAM roles and policies.

**Variables**:
- `environment` (string): Environment name
- `s3_bucket_name` (string): S3 bucket name for cache storage
- `upstream_base_url` (string): Default upstream service URL
- `cache_ttl_seconds` (number): Default cache TTL in seconds

**Outputs**:
- `lambda_function_name` (string): Lambda function name
- `lambda_invoke_arn` (string): Lambda invoke ARN
- `lambda_function_arn` (string): Lambda function ARN

**Resources**:
- `aws_lambda_function`
- `aws_iam_role`
- `aws_iam_role_policy`
- `aws_cloudwatch_log_group`

### S3 Module

**Path**: `infra/phase1/modules/s3/`

Creates S3 bucket for cache storage with encryption and lifecycle policies.

**Variables**:
- `environment` (string): Environment name
- `bucket_name` (string): S3 bucket name

**Outputs**:
- `bucket_name` (string): S3 bucket name
- `bucket_arn` (string): S3 bucket ARN

**Resources**:
- `aws_s3_bucket`
- `aws_s3_bucket_versioning`
- `aws_s3_bucket_server_side_encryption_configuration`
- `aws_s3_bucket_lifecycle_configuration`

### Route53 Module (Phase 1)

**Path**: `infra/phase1/modules/route53/`

Creates Route53 hosted zone and outputs nameservers.

**Variables**:
- `domain_name` (string): Domain name for hosted zone

**Outputs**:
- `hosted_zone_id` (string): Route53 hosted zone ID
- `nameservers` (list): Nameservers for domain configuration

**Resources**:
- `aws_route53_zone`

## Phase 2 Modules

### API Gateway Module (Phase 2)

**Path**: `infra/phase2/modules/apigateway/`

Creates API Gateway with custom domain configuration.

**Variables**:
- `environment` (string): Environment name
- `domain_name` (string): Custom domain name
- `certificate_arn` (string): SSL certificate ARN
- `lambda_function_name` (string): Lambda function name
- `lambda_invoke_arn` (string): Lambda invoke ARN

**Outputs**:
- `api_gateway_url` (string): API Gateway URL
- `api_gateway_id` (string): API Gateway ID
- `custom_domain_name` (string): Custom domain name

**Resources**:
- `aws_api_gateway_rest_api`
- `aws_api_gateway_resource`
- `aws_api_gateway_method`
- `aws_api_gateway_integration`
- `aws_api_gateway_deployment`
- `aws_api_gateway_domain_name`
- `aws_api_gateway_base_path_mapping`

### Route53 Module (Phase 2)

**Path**: `infra/phase2/modules/route53/`

Creates Route53 hosted zone with SSL certificates and DNS records.

**Variables**:
- `domain_name` (string): Domain name for hosted zone
- `api_gateway_domain_name` (string): API Gateway domain name
- `api_gateway_zone_id` (string): API Gateway zone ID

**Outputs**:
- `hosted_zone_id` (string): Route53 hosted zone ID
- `certificate_arn` (string): SSL certificate ARN
- `nameservers` (list): Nameservers for domain configuration

**Resources**:
- `aws_route53_zone`
- `aws_acm_certificate`
- `aws_acm_certificate_validation`
- `aws_route53_record` (certificate validation)
- `aws_route53_record` (A record)
- `aws_route53_record` (CNAME record)

## Module Usage

### Phase 1 Usage

```hcl
# infra/phase1/core.tf
module "s3" {
  source = "./modules/s3"
  
  environment = var.environment
  bucket_name = "dejafoo-cache-${var.environment}"
}

module "lambda" {
  source = "./modules/lambda"
  
  environment = var.environment
  s3_bucket_name = module.s3.bucket_name
  upstream_base_url = var.upstream_base_url
  cache_ttl_seconds = var.cache_ttl_seconds
}

module "apigateway" {
  source = "./modules/apigateway"
  
  environment = var.environment
  lambda_function_name = module.lambda.lambda_function_name
  lambda_invoke_arn = module.lambda.lambda_invoke_arn
}

module "route53" {
  source = "./modules/route53"
  
  domain_name = var.domain_name
}
```

### Phase 2 Usage

```hcl
# infra/phase2/dns.tf
module "route53" {
  source = "./modules/route53"
  
  domain_name = var.domain_name
  api_gateway_domain_name = module.apigateway.custom_domain_name
  api_gateway_zone_id = module.apigateway.api_gateway_zone_id
}

module "apigateway" {
  source = "./modules/apigateway"
  
  environment = var.environment
  domain_name = var.domain_name
  certificate_arn = module.route53.certificate_arn
  lambda_function_name = var.lambda_function_name
  lambda_invoke_arn = var.lambda_invoke_arn
}
```

## Module Dependencies

### Phase 1 Dependencies

```
S3 → Lambda → API Gateway
Route53 (independent)
```

### Phase 2 Dependencies

```
Route53 → API Gateway
```

## Module Variables

### Common Variables

All modules use these common variables:

- `environment` (string): Environment name (dev, staging, prod)
- `aws_region` (string): AWS region
- `tags` (map): Common tags for all resources

### Module-Specific Variables

Each module has specific variables for its functionality:

- **S3**: `bucket_name`, `encryption`, `lifecycle_policies`
- **Lambda**: `function_name`, `runtime`, `memory_size`, `timeout`
- **API Gateway**: `api_name`, `stage_name`, `throttle_settings`
- **Route53**: `domain_name`, `record_type`, `ttl`

## Module Outputs

### S3 Module Outputs

- `bucket_name`: S3 bucket name
- `bucket_arn`: S3 bucket ARN
- `bucket_domain_name`: S3 bucket domain name

### Lambda Module Outputs

- `lambda_function_name`: Lambda function name
- `lambda_function_arn`: Lambda function ARN
- `lambda_invoke_arn`: Lambda invoke ARN

### API Gateway Module Outputs

- `api_gateway_url`: API Gateway URL
- `api_gateway_id`: API Gateway ID
- `custom_domain_name`: Custom domain name (Phase 2)

### Route53 Module Outputs

- `hosted_zone_id`: Route53 hosted zone ID
- `nameservers`: Nameservers for domain configuration
- `certificate_arn`: SSL certificate ARN (Phase 2)

## Module Testing

### Unit Testing

Each module can be tested independently:

```bash
# Test S3 module
cd infra/phase1/modules/s3
terraform init
terraform plan

# Test Lambda module
cd infra/phase1/modules/lambda
terraform init
terraform plan
```

### Integration Testing

Test modules together:

```bash
# Test Phase 1 integration
cd infra/phase1
terraform init
terraform plan

# Test Phase 2 integration
cd infra/phase2
terraform init
terraform plan
```

## Module Customization

### Adding New Features

To add new features to modules:

1. **Update Variables**: Add new variables to `variables.tf`
2. **Update Resources**: Add new resources to `main.tf`
3. **Update Outputs**: Add new outputs to `outputs.tf`
4. **Update Documentation**: Update module documentation

### Module Versioning

Modules are versioned using Git tags:

```hcl
module "s3" {
  source = "git::https://github.com/camrail/dejafoo.git//infra/phase1/modules/s3?ref=v1.0.0"
  
  environment = var.environment
  bucket_name = "dejafoo-cache-${var.environment}"
}
```

## Best Practices

### Module Design

- **Single Responsibility**: Each module handles one AWS service
- **Reusability**: Modules can be reused across environments
- **Consistency**: Consistent naming and structure
- **Documentation**: Clear documentation for all modules

### Module Testing

- **Unit Tests**: Test each module independently
- **Integration Tests**: Test modules together
- **Validation**: Use `terraform validate` and `terraform plan`

### Module Maintenance

- **Version Control**: Use Git tags for module versions
- **Documentation**: Keep documentation up to date
- **Testing**: Test changes before deployment
- **Monitoring**: Monitor module performance and costs
