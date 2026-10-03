import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, classifyArgv, classifySql, checkReadPath, checkWritePath, PolicyDenied } from "../src/lib/policy.mjs";

const verdict = (cmd) => classifyArgv(tokenize(cmd)).decision;

test("tokenize: separa comillas y rechaza operadores de shell", () => {
  assert.deepEqual(tokenize(`git commit -m "hola mundo"`), ["git", "commit", "-m", "hola mundo"]);
  for (const bad of ["ls; rm -rf /", "ls && ls", "cat a | grep b", "echo hi > f", "echo `id`", "echo $(id)", "ls\nls"]) {
    assert.throws(() => tokenize(bad), PolicyDenied, bad);
  }
  assert.deepEqual(tokenize(`echo "a;b"`), ["echo", "a;b"]);
});

test("comandos seguros se permiten automaticamente", () => {
  for (const c of ["git status", "git diff --stat", "git log -5", "git branch --list", "git branch --show-current", "git switch -c agent/x", "git add -- a.txt", "./mvnw -B test", "npm run build", "npm ci", "npx playwright test", "node script.mjs", "gh pr list --json number", "gh api repos/x/y/commits", "ls -la", "grep -rn foo src"]) {
    assert.equal(verdict(c), "allow", c);
  }
});

test("operaciones sensibles requieren aprobacion", () => {
  for (const c of ["git push origin main", "git push --force", "git reset --hard HEAD~1", "git clean -fd", "git checkout -- file", "git branch -D x", "git branch -m nuevo", "git branch nueva-rama", "git rebase main", "git commit --no-verify -m x", "git stash drop", "rm file.txt", "curl http://x", "node -e 1", "gh pr create --title a", "gh pr merge 3", "gh api -X POST repos/a/b/issues", "gh api repos/a/b/issues -f title=x", "npm publish", "npm install -g foo", "npx cowsay", "./mvnw deploy", "find . -delete", "ls /etc", "npx playwright install", "npx playwright install chromium", "npx playwright install-deps", "npx ng add @angular/material", "npx ng update"]) {
    assert.equal(verdict(c), "approval", c);
  }
});

test("operaciones prohibidas se deniegan siempre", () => {
  for (const c of ["sudo ls", "ssh host", "chmod 777 f", "cat .env", "cat ../.ssh/id_rsa", "ls .env.local", "cat server.key", "npm --prefix agent run approve -- approve apr_1", "node agent/src/cli/approve.mjs approve x"]) {
    assert.equal(verdict(c), "deny", c);
  }
  assert.equal(verdict("cat .env.example"), "allow");
});

test("SQL: solo lectura pasa; escritura/DDL/multi-sentencia no", () => {
  assert.equal(classifySql("SELECT * FROM usuarios WHERE deleted = 0").decision, "allow");
  assert.equal(classifySql("select u.updated_at, u.deleted_at from usuarios u").decision, "allow");
  assert.equal(classifySql("SHOW TABLES").decision, "allow");
  assert.equal(classifySql("EXPLAIN SELECT 1").decision, "allow");
  assert.equal(classifySql("/* c */ SELECT 1; ").decision, "allow");
  for (const q of ["DROP TABLE usuarios", "TRUNCATE usuarios", "DELETE FROM usuarios", "UPDATE usuarios SET puntos=0", "INSERT INTO a VALUES (1)", "ALTER TABLE a ADD b int", "CREATE TABLE z(i int)"]) {
    assert.equal(classifySql(q).decision, "approval", q);
  }
  assert.equal(classifySql("SELECT 1; DROP TABLE usuarios").decision, "deny");
  assert.equal(classifySql("SELECT * FROM t INTO OUTFILE '/tmp/x'").decision, "deny");
  assert.equal(classifySql("SELECT SLEEP(100)").decision, "deny");
  assert.equal(classifySql("SELECT 1 WHERE 1=1 AND 1 IN (SELECT 1 FROM x FOR UPDATE)").decision, "deny");
  assert.equal(classifySql("   ").decision, "deny");
  assert.equal(classifySql("SELECT 'drop table x'").decision, "allow");
});

test("rutas protegidas de lectura y escritura", () => {
  for (const p of [".env", ".env.local", "keys/server.pem", "x/.ssh/id_rsa"]) assert.equal(checkReadPath(p).decision, "deny", p);
  assert.equal(checkReadPath(".env.example").decision, "allow");
  assert.equal(checkReadPath("src/main/java/A.java").decision, "allow");
  for (const p of [".git/config", "agent/config/policy.json", "agent/src/lib/policy.mjs", "agent/data/approvals.jsonl", ".claude/settings.json", ".mcp.json", ".env", "frontend/node_modules/x/y.js", "backups/dump.sql"]) {
    assert.equal(checkWritePath(p).decision, "deny", p);
  }
  for (const p of ["src/main/java/A.java", "AGENTS.md", "agent/src/tools/git.mjs", ".agent/memory.jsonl"]) assert.equal(checkWritePath(p).decision, "allow", p);
});
