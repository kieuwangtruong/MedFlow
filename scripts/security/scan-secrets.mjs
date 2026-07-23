import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const binaryExtensions = new Set([
  '.db', '.gif', '.ico', '.jpeg', '.jpg', '.joblib', '.pdf', '.png', '.webp', '.xlsx',
])

const rules = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'github-token', pattern: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'openai-style-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  {
    id: 'credential-in-database-url',
    pattern: /postgres(?:ql)?(?:\+[a-z0-9_]+)?:\/\/[^:\s"'<>]+:[^@\s"'<>]+@[^\s"'<>]+/gi,
    allow: (match) => /@localhost(?::|\/)/i.test(match)
      || /:\/\/(?:user:password|postgres:postgres|test:test)@(?:host|db)(?::|\/)/i.test(match),
  },
  {
    id: 'hard-coded-secret',
    pattern: /\b(?:api[_-]?key|jwt[_-]?secret|password|access[_-]?token)\b\s*[:=]\s*["']([^"']{6,})["']/gi,
    allow: (match) => /demo|development|example|placeholder|required|optional|redacted/i.test(match),
  },
]

function extension(path) {
  const match = path.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ''
}

function repositoryFiles() {
  return execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

const findings = []

const files = repositoryFiles()

for (const file of files) {
  if (binaryExtensions.has(extension(file))) continue

  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (content.includes('\0')) continue

  for (const rule of rules) {
    rule.pattern.lastIndex = 0
    for (const match of content.matchAll(rule.pattern)) {
      if (rule.allow?.(match[0])) continue
      const line = content.slice(0, match.index).split('\n').length
      findings.push({ file, line, rule: rule.id })
    }
  }
}

if (findings.length) {
  console.error('Potential secrets detected. Values are intentionally suppressed:')
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}]`)
  }
  process.exit(1)
}

console.log(`Secret scan passed for ${files.length} repository files.`)
