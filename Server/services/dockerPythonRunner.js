import { exec } from "child_process";

export const runPythonInDocker = (code) => {
  return new Promise((resolve, reject) => {
    const safeCode = JSON.stringify(code);

    const command = `docker run --rm -i kodikos-python python3 /app/run.py`;

    const process = exec(command, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) return resolve(`❌ Error: ${stderr || err.message}`);
      resolve(stdout.trim());
    });

    process.stdin.write(code);
    process.stdin.end();
  });
};
