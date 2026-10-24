import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const mainPath = fileURLToPath(new URL('../../dist/main.js', import.meta.url));
export const runCli = async (
  cwd: string,
  input: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mainPath], { cwd, shell: false, stdio: 'pipe' });
    let stdout = '',
      stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('CLI did not terminate after EOF'));
    }, 20000);
    child.stdout.setEncoding('utf8').on('data', (s) => {
      stdout += s;
    });
    child.stderr.setEncoding('utf8').on('data', (s) => {
      stderr += s;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
