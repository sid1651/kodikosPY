// services/dockercppRunner.js

import { exec } from "child_process";
import fs from "fs"; // Still imported, but its core functions are unused in the main logic
import os from "os";
import path from "path";

const CODE_INPUT_DELIMITER = "---INPUT-STREAM---"; // Unique separator for code and input

/**
 * Run C++ code inside Docker via STDIN stream
 * @param {string} code - The C++ code to run
 * @param {string} input - Optional program input
 * @returns {Promise<{output: string}>} - Program output or errors
 */
export const runCppCode = (code, input) => {
  return new Promise((resolve, reject) => {
    // 1️⃣ Combine code and input with a delimiter
    const combinedStream = code + "\n" + CODE_INPUT_DELIMITER + "\n" + (input || "");

    // 2️⃣ Start Docker container detached and interactive
    const runCmd = `docker run -d -i --rm --pids-limit=20 --memory=300m cpp-runner`;

    exec(runCmd, (err, containerId) => {
      if (err) return reject("❌ Docker start failed: " + err.message);

      containerId = containerId.trim();
      
      // 3️⃣ Execute the shell script inside the container using stdin
      const execCmd = `docker exec -i ${containerId} /run.sh`;
      const child = exec(execCmd, { timeout: 6000 }, (execErr, stdout, stderr) => {

        // 4️⃣ Stop + remove container (Cleanup)
        exec(`docker rm -f ${containerId}`, () => {});

        if (execErr) {
          console.error("Exec Error:", execErr);
          return resolve({ output: stderr || execErr.message });
        }

        if (stdout.startsWith("ERROR::")) {
          console.log("Compilation Error Detected");
          return resolve({ output: stdout.replace("ERROR::", "") });
        }

        resolve({ output: stdout.trim() });
      });

      // 5️⃣ Pipe the combined stream into the container's shell script STDIN
      child.stdin.write(combinedStream);
      child.stdin.end();
    });
  });
};