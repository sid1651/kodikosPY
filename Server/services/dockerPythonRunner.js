import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const runPythonInDocker = (code) => {
  return new Promise((resolve) => {
    // 🔥 Create real temp folder (works for Linux, Mac, Windows)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "py-run-"));

    const command = `
      docker run --rm -i \
        --network=none \
        --read-only \
        --pids-limit=20 \
        --memory=100m \
        --cpus=0.3 \
        --cap-drop=ALL \
        --security-opt no-new-privileges \
        -v ${tempDir}:/tmp \
        kodikos-python python3 /app/run.py
    `.trim();

    const process = exec(command, { timeout: 5000 }, (err, stdout, stderr) => {
      console.log("---- DOCKER LOGS ----");
      console.log("ERR:", err);
      console.log("STDERR:", stderr);
      console.log("STDOUT:", stdout);
      console.log("----------------------");

      if (err) {
        return resolve(`❌ Error: ${stderr || err.message}`);
      }

      resolve(stdout.trim());
    });

    process.stdin.write(code);
    process.stdin.end();
  });
};
