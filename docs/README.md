# Dejafoo Documentation

This directory contains the complete documentation for Dejafoo, built with MkDocs and Material theme.

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Serve locally
mkdocs serve
# Documentation will be available at http://localhost:8000
```

### Build Documentation

```bash
# Build static site
mkdocs build
# Output will be in the 'site/' directory
```

### Deploy to GitHub Pages

```bash
# Deploy to GitHub Pages
mkdocs gh-deploy
```

## Documentation Structure

```
docs/
├── mkdocs.yml              # MkDocs configuration
├── requirements.txt         # Python dependencies
├── build.sh                # Build script
├── serve.sh                # Local development server
├── deploy.sh               # Deployment script
├── index.md                # Homepage
├── getting-started/        # Getting started guides
│   ├── index.md
│   ├── quick-start.md
│   ├── installation.md
│   └── configuration.md
├── user-guide/             # User guides
│   ├── index.md
│   ├── usage.md
│   ├── caching.md
│   ├── custom-domains.md
│   └── monitoring.md
├── api-reference/          # API documentation
│   ├── index.md
│   ├── endpoints.md
│   ├── parameters.md
│   ├── headers.md
│   └── response-format.md
├── deployment/             # Deployment guides
│   ├── index.md
│   ├── infrastructure.md
│   ├── code-deployment.md
│   └── troubleshooting.md
├── development/            # Development guides
│   ├── index.md
│   ├── architecture.md
│   ├── testing.md
│   └── contributing.md
└── reference/              # Technical reference
    ├── index.md
    ├── terraform-modules.md
    ├── environment-variables.md
    └── aws-resources.md
```

## Features

- **Material Theme**: Modern, responsive design
- **Search**: Full-text search functionality
- **Navigation**: Hierarchical navigation with sections
- **Code Highlighting**: Syntax highlighting for code blocks
- **Mermaid Diagrams**: Support for Mermaid diagrams
- **Responsive**: Mobile-friendly design
- **Dark Mode**: Automatic dark/light mode switching

## Configuration

### MkDocs Configuration

The documentation is configured in `mkdocs.yml`:

- **Theme**: Material theme with custom palette
- **Plugins**: Search, Mermaid, Git revision date, Minify, Redirects
- **Extensions**: Various Markdown extensions for enhanced functionality
- **Navigation**: Hierarchical navigation structure

### Customization

To customize the documentation:

1. **Update Navigation**: Edit the `nav` section in `mkdocs.yml`
2. **Add Pages**: Create new Markdown files and add to navigation
3. **Customize Theme**: Modify theme settings in `mkdocs.yml`
4. **Add Plugins**: Install and configure additional plugins

## Development

### Adding New Content

1. **Create Markdown File**: Add new `.md` file in appropriate directory
2. **Update Navigation**: Add to `nav` section in `mkdocs.yml`
3. **Test Locally**: Run `mkdocs serve` to test changes
4. **Commit Changes**: Commit and push to trigger deployment

### Writing Guidelines

- **Markdown**: Use standard Markdown syntax
- **Code Blocks**: Use appropriate language tags for syntax highlighting
- **Links**: Use relative links for internal documentation
- **Images**: Store images in appropriate directories
- **Diagrams**: Use Mermaid syntax for diagrams

### Code Examples

```markdown
```bash
# Command line example
curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

```javascript
// JavaScript example
const response = await fetch('https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h');
const data = await response.json();
```
```

## Deployment

### Automatic Deployment

Documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### Manual Deployment

```bash
# Deploy manually
mkdocs gh-deploy
```

### Custom Domain

To use a custom domain:

1. **Add CNAME File**: Create `docs/CNAME` with your domain
2. **Configure DNS**: Point your domain to GitHub Pages
3. **Update Settings**: Update GitHub Pages settings

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Markdown syntax and YAML configuration
2. **Missing Dependencies**: Run `pip install -r requirements.txt`
3. **Navigation Issues**: Check `nav` section in `mkdocs.yml`
4. **Plugin Errors**: Verify plugin configuration and versions

### Debug Commands

```bash
# Check MkDocs configuration
mkdocs config

# Validate configuration
mkdocs config --strict

# Build with verbose output
mkdocs build --verbose
```

## Contributing

### Documentation Contributions

1. **Fork Repository**: Fork the Dejafoo repository
2. **Create Branch**: Create feature branch for documentation changes
3. **Make Changes**: Update documentation files
4. **Test Locally**: Run `mkdocs serve` to test changes
5. **Submit PR**: Submit pull request with documentation changes

### Documentation Standards

- **Accuracy**: Ensure all information is accurate and up-to-date
- **Clarity**: Write clear, concise documentation
- **Examples**: Include practical examples and code snippets
- **Structure**: Follow established documentation structure
- **Links**: Use appropriate internal and external links

## Support

For documentation issues:

1. **Check Issues**: Look for existing issues on GitHub
2. **Create Issue**: Create new issue for documentation problems
3. **Contact**: Reach out to the Dejafoo team

## License

This documentation is licensed under the same license as the Dejafoo project (MIT License).
