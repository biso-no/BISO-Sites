# Quick Translation Guide

## 🚀 Quick Start

### One-Time Setup

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Make sure dependencies are installed: `bun install` (in monorepo root)

### Translate All Files

```bash
cd packages/i18n
OPENAI_API_KEY=sk-your-key-here bun run translate
```

### Safe Testing (Recommended First)

```bash
# Test with one file first
OPENAI_API_KEY=sk-your-key-here bun run translate --dry-run --file=common.json

# If it looks good, translate that file for real
OPENAI_API_KEY=sk-your-key-here bun run translate --file=common.json

# Then translate everything
OPENAI_API_KEY=sk-your-key-here bun run translate
```

## 📋 Common Workflows

### Adding a New Feature with Translations

1. Create your English translations in `messages/en/yourfile.json`
2. Run the translator on just that file:
   ```bash
   OPENAI_API_KEY=sk-... bun run translate --file=yourfile.json
   ```
3. Review the Norwegian output in `messages/no/yourfile.json`
4. Commit both files

### Updating Existing Translations

1. Update the English file in `messages/en/`
2. Run the translator to update Norwegian:
   ```bash
   OPENAI_API_KEY=sk-... bun run translate --file=yourfile.json
   ```
3. Review changes: `git diff messages/no/yourfile.json`
4. Commit if satisfied

### Mass Translation Update

Need to retranslate everything (e.g., after changing translation style)?

```bash
# Preview first
OPENAI_API_KEY=sk-... bun run translate --dry-run

# Backup existing translations (optional)
cp -r messages/no messages/no.backup

# Translate all
OPENAI_API_KEY=sk-... bun run translate

# Review changes
git diff messages/no/
```

## 💡 Tips

- **Always use `--dry-run` first** when testing new translations
- **Start with one file** to validate quality before bulk translation
- **The script preserves**:
  - JSON structure and keys
  - Variable placeholders like `{name}`, `{count}`, etc.
  - HTML tags
  - Special formatting
- **Cost**: ~$0.10-0.20 per file depending on size (GPT-4o pricing)
- **Time**: ~2-5 seconds per file + 1 second delay between files

## 🔧 Troubleshooting

### "OPENAI_API_KEY environment variable is required"

You forgot to set the API key. Use:
```bash
OPENAI_API_KEY=sk-your-key bun run translate
```

### Rate Limit Errors

Wait a minute, then retry. Or translate files one at a time:
```bash
OPENAI_API_KEY=sk-... bun run translate --file=admin.json
# wait a minute
OPENAI_API_KEY=sk-... bun run translate --file=common.json
```

### Translation Quality Issues

The script uses GPT-4o with Norwegian Bokmål instructions. If translations aren't great:
1. Try translating specific problematic files individually
2. Edit the resulting Norwegian files manually
3. Consider adjusting the prompt in `scripts/translate.ts`

## 📚 Full Documentation

See [scripts/README.md](./scripts/README.md) for complete documentation including:
- Detailed usage instructions
- All command-line options
- Cost estimation
- CI/CD integration examples
- Advanced troubleshooting

