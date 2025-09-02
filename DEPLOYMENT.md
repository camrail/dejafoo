# 🚀 Dejafoo Managed Service Deployment Guide

This guide will walk you through deploying your dejafoo HTTP proxy as a managed service on AWS Lambda.

## 📋 Prerequisites

### 1. AWS Account Setup
- Create a new AWS account at [aws.amazon.com](https://aws.amazon.com)
- Set up billing information (Lambda has a generous free tier)
- Create an IAM user with programmatic access

### 2. Install Required Tools

#### AWS CLI
```bash
# macOS
brew install awscli

# Or download from AWS
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

#### Terraform
```bash
# macOS
brew install terraform

# Or download from HashiCorp
# https://www.terraform.io/downloads.html
```

#### Rust Cross-Compilation
```bash
# Add the Linux target for Lambda
rustup target add x86_64-unknown-linux-gnu

# Install cross-compilation tools (macOS)
brew install FiloSottile/musl-cross/musl-cross
```

### 3. Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key  
# Enter your default region (e.g., us-east-1)
# Enter your default output format (json)
```

## 🚀 Deployment Steps

### Step 1: Clone and Setup
```bash
git clone <your-repo-url>
cd dejafoo
```

### Step 2: Deploy to AWS
```bash
# Deploy to dev environment in us-east-1
./scripts/deploy.sh dev us-east-1

# Or deploy to production
./scripts/deploy.sh prod us-west-2
```

### Step 3: Test Your Managed Service
After deployment, you'll get a Lambda function URL. Test it:

```bash
# Test with customer subdomain, API, and custom TTL
curl -H "Host: abc.dejafoo.io" "https://your-lambda-url.lambda-url.us-east-1.on.aws/?url=https://jsonplaceholder.typicode.com/todos/1&ttl=7d"

# Test with different customer and TTL
curl -H "Host: xyz.dejafoo.io" "https://your-lambda-url.lambda-url.us-east-1.on.aws/?url=https://api.github.com/users/octocat&ttl=30m"

# Each customer gets separate cache entries with their own TTL!
```

## 🏗️ What Gets Deployed

### AWS Resources Created:
- **Lambda Function**: Runs your Rust proxy code
- **DynamoDB Table**: Stores cache metadata and small responses
- **S3 Bucket**: Stores large cached responses
- **IAM Roles**: Permissions for Lambda to access DynamoDB and S3
- **CloudWatch Logs**: Application logging

### Infrastructure Costs (Estimated):
- **Lambda**: Free tier includes 1M requests/month
- **DynamoDB**: Free tier includes 25GB storage
- **S3**: Free tier includes 5GB storage
- **Total**: ~$0-5/month for light usage

## 🔧 Configuration

### Environment Variables
The Lambda function uses these environment variables:
- `RUST_LOG`: Logging level (info, debug, etc.)
- `DYNAMODB_TABLE_NAME`: DynamoDB table name (auto-set)
- `S3_BUCKET_NAME`: S3 bucket name (auto-set)

**Note**: No `UPSTREAM_BASE_URL` needed - customers provide their own URLs via `?url=` parameter

### Customer API URLs and TTL
Customers provide their own API URLs and cache TTL via query parameters:
```bash
# Customer "abc" proxies their API with 7-day cache
abc.dejafoo.io/?url=https://api.abc.com/users/1&ttl=7d

# Customer "xyz" proxies their API with 30-minute cache
xyz.dejafoo.io/?url=https://api.xyz.com/products/123&ttl=30m

# Customer "company" proxies their API with 2-hour cache
company.dejafoo.io/?url=https://api.company.com/data/456&ttl=2h
```

### TTL Format Support:
- **Seconds**: `60s`, `120s`
- **Minutes**: `30m`, `90m` 
- **Hours**: `2h`, `12h`
- **Days**: `7d`, `30d`
- **Default**: 1 hour if no TTL specified

## 🌐 Multi-Tenant Usage

### Subdomain Support
Your deployed proxy supports multi-tenant subdomains:

```bash
# Organization "abc"
curl -H "Host: abc.dejafoo.io" "https://your-lambda-url/todos/1"

# Organization "xyz" 
curl -H "Host: xyz.dejafoo.io" "https://your-lambda-url/todos/1"

# Each gets separate cache entries!
```

### Custom Domain (Optional)
To use your own domain:
1. Buy a domain (e.g., `dejafoo.io`)
2. Set up Route 53 hosted zone
3. Configure API Gateway custom domain
4. Update DNS records

## 📊 Monitoring

### CloudWatch Logs
View logs in AWS Console:
- Go to CloudWatch → Log Groups
- Find `/aws/lambda/dejafoo-proxy-dev`

### Metrics
Monitor in CloudWatch:
- Invocations
- Duration
- Errors
- Throttles

## 🔄 Updates

To update your deployment:
```bash
# Make your code changes
git add .
git commit -m "Update proxy logic"

# Redeploy
./scripts/deploy.sh dev us-east-1
```

## 🧹 Cleanup

To remove all resources:
```bash
cd infra
terraform destroy
```

## 🆘 Troubleshooting

### Common Issues:

1. **"AWS CLI not configured"**
   ```bash
   aws configure
   ```

2. **"Terraform not found"**
   ```bash
   brew install terraform
   ```

3. **"Cross-compilation failed"**
   ```bash
   rustup target add x86_64-unknown-linux-gnu
   ```

4. **"Permission denied"**
   - Check IAM user has Lambda, DynamoDB, S3 permissions
   - Ensure AWS credentials are valid

### Getting Help:
- Check CloudWatch logs for runtime errors
- Verify environment variables are set correctly
- Test locally first with `USE_FILE_CACHE=1`

## 🎯 Next Steps

After successful deployment:
1. **Test multi-tenant functionality** with different subdomains
2. **Monitor performance** in CloudWatch
3. **Set up custom domain** for production use
4. **Configure alerts** for errors and high latency
5. **Scale up** by increasing Lambda memory/timeout as needed

Your dejafoo proxy is now running in the cloud! 🎉
