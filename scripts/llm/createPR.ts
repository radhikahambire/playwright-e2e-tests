import { execSync } from "child_process";

function run(command: string) {
  execSync(command, {
    stdio: "inherit",
  });
}

function main() {
  const branch = `ai-fix-${Date.now()}`;

  run(`git checkout -b ${branch}`);

  run('git config user.name "github-actions"');
  run('git config user.email "github-actions@github.com"');

  run("git add tests pages");

  run('git commit -m "AI-generated Playwright fixes"');

  run(`git push origin ${branch}`);

  run(`gh pr create \
    --title "AI-generated Playwright fixes" \
    --body "Automated Playwright self-healing fixes" \
    --base main \
    --head ${branch}`);
}

main();