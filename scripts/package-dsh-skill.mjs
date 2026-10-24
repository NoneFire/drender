import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedSkill = resolve(workspaceRoot, '.agents/skills/drender-report/SKILL.md');
const packagedSkill = resolve(workspaceRoot, 'plugins/hosts/dsh/lib/skills/drender-report/SKILL.md');

await mkdir(dirname(packagedSkill), { recursive: true });
await copyFile(sharedSkill, packagedSkill);
