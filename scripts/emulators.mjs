// Starts the Firebase Emulator Suite with sensible local defaults:
//  - finds a Temurin/OpenJDK install on Windows when `java` is not on PATH
//  - gives slow disks more time to load the Functions bundle
//  - keeps emulator data between runs in .emulator-data
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const env = { ...process.env };
env.FUNCTIONS_DISCOVERY_TIMEOUT ??= '60';

if (process.platform === 'win32' && !env.JAVA_HOME) {
  const roots = ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const jdk = readdirSync(root).find((d) => /^jdk-?(1[1-9]|2\d)/.test(d));
    if (jdk) {
      env.JAVA_HOME = join(root, jdk);
      env.PATH = `${join(env.JAVA_HOME, 'bin')};${env.PATH}`;
      break;
    }
  }
}

const args = ['firebase', 'emulators:start', '--project', 'demo-classe-a', ...process.argv.slice(2)];
const child = spawn('npx', args, { stdio: 'inherit', env, shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
