import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Run C++ code inside Docker using temporary files
 * @param {string} code - The C++ code to run
 * @param {string} input - Optional program input
 * @returns {Promise<{output: string}>} - Program output or errors
 */
export const runCppCode = (code, input = "") => {
  return new Promise((resolve, reject) => {
    // 1️⃣ Create temporary directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpp-"));
    const codePath = path.join(tempDir, "code.cpp");
    const inputPath = path.join(tempDir, "input.txt");

    // 2️⃣ Save code and input to files
    fs.writeFileSync(codePath, code);
    fs.writeFileSync(inputPath, input);

    // 3️⃣ Docker command: mount temp folder to /app in container
    const cmd = `docker run --rm -v ${tempDir}:/app cpp-runner`;

    console.log("=== Docker Command ===\n", cmd);

    // 4️⃣ Execute the container
    exec(cmd, (error, stdout, stderr) => {
      // Clean up temp directory
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

      if (error) {
        console.error("Exec Error:", error);
        return resolve({ output: stderr || error.message });
      }

      if (stdout.startsWith("ERROR::")) {
        console.log("Compilation Error Detected");
        return resolve({ output: stdout.replace("ERROR::", "") });
      }

      resolve({ output: stdout });
    });
  });
};
