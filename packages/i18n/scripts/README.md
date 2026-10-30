# Translation Scripts

This directory contains scripts for managing translations in the i18n package.

## translate.ts

Translates all JSON files from `messages/en` to `messages/no` using OpenAI's gpt-5-mini model.

### Prerequisites

1. **OpenAI API Key**: You need an OpenAI API key with access to gpt-5-mini
2. **Dependencies**: Run `bun install` in the root of the monorepo

### Usage

#### Basic Usage

Translate all files from English to Norwegian:

```bash
cd packages/i18n
ANTHROPIC_API_KEY=your_api_key_here bun run translate
```

#### Dry Run Mode

Preview translations without writing files:

```bash
ANTHROPIC_API_KEY=your_api_key_here bun run translate --dry-run
```

#### Translate a Single File

Translate only a specific file:

```bash
ANTHROPIC_API_KEY=your_api_key_here bun run translate --file=admin.json
```

#### Combine Options

```bash
ANTHROPIC_API_KEY=your_api_key_here bun run translate --dry-run --file=common.json
```

### Features

- ✅ **Preserves JSON Structure**: Only translates values, never keys
- 🧠 **Context-Aware**: Uses gpt-5-mini for natural, professional translations
- 🔄 **Nested Objects**: Handles deeply nested JSON structures
- 🛡️ **Safe**: Preserves placeholders, HTML tags, and special formatting
- 📊 **Progress Tracking**: Shows detailed progress and statistics
- 🔍 **Dry Run**: Test translations before committing
- 🎯 **Selective Translation**: Translate specific files only
- ⏱️ **Rate Limiting**: Built-in delays to avoid API rate limits

### Translation Quality

The script uses gpt-5-mini with specific instructions to:

1. Use Norwegian Bokmål (the most common written Norwegian)
2. Maintain professional business/admin terminology
3. Keep technical terms appropriate for the context
4. Preserve all variable placeholders like `{variable}`
5. Maintain HTML tags and formatting
6. Use natural, idiomatic Norwegian

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your OpenAI API key |

### Output

The script provides detailed output including:

- Per-file progress with emoji indicators
- Number of keys translated per file
- Translation time and statistics
- Error reporting if any issues occur
- Summary with total counts and duration

Example output:

```
🌍 JSON Translation Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: /path/to/messages/en
Target: /path/to/messages/no
Mode: WRITE FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Found 29 file(s) to translate

📄 Processing: admin.json
  📖 Read 95 translation keys
  🤖 Sending to OpenAI for translation...
  ✅ Translation completed
  💾 Saved to: /path/to/messages/no/admin.json

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Translation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Files processed: 29/29
🔑 Keys translated: 2,450
❌ Errors: 0
⏱️  Duration: 45.32s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Translation completed successfully!
```

### Cost Estimation

Translation costs depend on:
- Number of files (29 files currently)
- Size of each file
- OpenAI API pricing for gpt-5-mini

Approximate cost for translating all 29 files: $2-5 USD

### Troubleshooting

#### "ANTHROPIC_API_KEY environment variable is required"

Make sure you're providing the API key:

```bash
ANTHROPIC_API_KEY=sk-... bun run translate
```

#### Rate Limit Errors

The script includes 1-second delays between files. If you still hit rate limits:
1. Use `--file=` option to translate one file at a time
2. Wait a few minutes between batches
3. Check your OpenAI account rate limits

#### Invalid JSON Errors

If a translation produces invalid JSON:
1. Check the source file is valid JSON
2. Try translating the file individually with `--file=`
3. Use `--dry-run` to preview the output

### Best Practices

1. **Always run with `--dry-run` first** to preview translations
2. **Test with a single file** before running on all files:
   ```bash
   ANTHROPIC_API_KEY=... bun run translate --dry-run --file=common.json
   ```
3. **Review changes** before committing:
   ```bash
   git diff packages/i18n/messages/no/
   ```
4. **Backup existing translations** if needed:
   ```bash
   cp -r packages/i18n/messages/no packages/i18n/messages/no.backup
   ```

### Integration with CI/CD

You can integrate this into your workflow:

```yaml
# Example GitHub Actions workflow
- name: Translate new content
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    cd packages/i18n
    bun run translate --file=newly-added.json
```

### Future Enhancements

Potential improvements:
- Support for additional languages (sv, da, fi)
- Parallel translation of multiple files
- Incremental translation (only changed keys)
- Translation memory to reuse previous translations
- Quality validation and consistency checks

