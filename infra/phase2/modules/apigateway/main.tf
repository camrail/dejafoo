# API Gateway configuration for custom domain support
resource "aws_api_gateway_rest_api" "dejafoo_api" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "Dejafoo proxy API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

# Lambda integration
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.dejafoo_api.id
  parent_id   = aws_api_gateway_rest_api.dejafoo_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.dejafoo_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.dejafoo_api.id
  resource_id = aws_api_gateway_method.proxy.resource_id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_invoke_arn
}

# Root resource method
resource "aws_api_gateway_method" "root" {
  rest_api_id   = aws_api_gateway_rest_api.dejafoo_api.id
  resource_id   = aws_api_gateway_rest_api.dejafoo_api.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.dejafoo_api.id
  resource_id = aws_api_gateway_method.root.resource_id
  http_method = aws_api_gateway_method.root.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_invoke_arn
}

# Deployment
resource "aws_api_gateway_deployment" "dejafoo_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.lambda_root,
  ]

  rest_api_id = aws_api_gateway_rest_api.dejafoo_api.id
  stage_name  = var.environment

  lifecycle {
    create_before_destroy = true
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dejafoo_api.execution_arn}/*/*"
}

# Custom domain
resource "aws_api_gateway_domain_name" "dejafoo_domain" {
  count           = var.domain_name != "" ? 1 : 0
  domain_name     = var.domain_name
  certificate_arn = var.certificate_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

# Base path mapping
resource "aws_api_gateway_base_path_mapping" "dejafoo_mapping" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = aws_api_gateway_rest_api.dejafoo_api.id
  stage_name  = aws_api_gateway_deployment.dejafoo_deployment.stage_name
  domain_name = aws_api_gateway_domain_name.dejafoo_domain[0].domain_name
}

# Wildcard subdomain mapping
resource "aws_api_gateway_domain_name" "dejafoo_wildcard_domain" {
  count           = var.domain_name != "" ? 1 : 0
  domain_name     = "*.${var.domain_name}"
  certificate_arn = var.certificate_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

resource "aws_api_gateway_base_path_mapping" "dejafoo_wildcard_mapping" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = aws_api_gateway_rest_api.dejafoo_api.id
  stage_name  = aws_api_gateway_deployment.dejafoo_deployment.stage_name
  domain_name = aws_api_gateway_domain_name.dejafoo_wildcard_domain[0].domain_name
}
