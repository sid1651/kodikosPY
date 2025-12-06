import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import ContainerPool from "./containerPool.js";

// Load environment variables FIRST
dotenv.config();

const execAsync = promisify(exec);

// Create C++ container pool
// Pool size can be configured via environment variable
const CPP_POOL_SIZE = parseInt(process.env.CPP_POOL_SIZE || "5", 10);

// Use Docker Hub image: sidhu1651/cpp-runner
const CPP_IMAGE = process.env.CPP_DOCKER_IMAGE || "sidhu1651/cpp-runner";

console.log(`🔧 C++ Pool using image: ${CPP_IMAGE}`);

const cppPool = new ContainerPool(CPP_IMAGE, CPP_POOL_SIZE, {
  cmd: "tail -f /dev/null", // Keep container running
  readOnly: false, // Need writable FS to copy/compile user code
  flags: [
    "--network=none",
    "--pids-limit=20",
    "--memory=300m",
    "--cpus=0.5",
    "--cap-drop=ALL",
    "--security-opt no-new-privileges",
    // Note: Not using --read-only because we need to compile inside container
  ],
});

/**
 * Initialize C++ container pool on service startup
 * Pre-warms containers to eliminate cold start delays
 */
export const initializeCppPool = async () => {
  await cppPool.initialize();
};

/**
 * Get C++ pool statistics
 */
export const getCppPoolStats = () => {
  return cppPool.getStats();
};

/**
 * Run C++ code inside Docker using container pool
 * Reuses warm containers for fast compilation and execution
 * @param {string} code - The C++ code to run
 * @param {string} input - Optional program input
 * @returns {Promise<{output: string}>} - Program output or errors
 */
export const runCppCode = (code, input) => {
  return new Promise(async (resolve, reject) => {
    process.stdout.write(`🔍 DEBUG runCppCode START: code length=${code?.length}, input=${input || 'none'}\n`);
    process.stdout.write(`🔍 DEBUG runCppCode: cppPool instanceId=${cppPool.instanceId}, imageName="${cppPool.imageName}"\n`);
    let containerId = null;
    let tempDir = null;

    try {
      // 1️⃣ Create temporary directory
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpp-"));
      const codePath = path.join(tempDir, "code.cpp");
      const inputPath = path.join(tempDir, "input.txt");

      // 2️⃣ Save code and input to files
      fs.writeFileSync(codePath, code);
      fs.writeFileSync(inputPath, input || "");

      // 3️⃣ Get container from pool (FAST - no cold start!)
      console.log(`🔍 DEBUG runCppCode: About to call cppPool.getContainer(), cppPool instance:`, cppPool);
      console.log(`🔍 DEBUG runCppCode: cppPool.imageName = "${cppPool.imageName}"`);
      containerId = await cppPool.getContainer();

      // 4️⃣ Copy files into container
      await execAsync(`docker cp ${codePath} ${containerId}:/app/code.cpp`);
      if (input) {
        await execAsync(`docker cp ${inputPath} ${containerId}:/app/input.txt`);
      }

      // 5️⃣ Compile and execute inside container
      // Keep the script simple to avoid shell parsing issues inside sh -c
      const compileAndRunCmd =
        'cd /app; ' +
        'g++ code.cpp -o program 2> errors.txt; ' +
        'if [ -s errors.txt ]; then ' +
          'echo "ERROR::$(cat errors.txt)"; ' +
        'elif [ -f input.txt ]; then ' +
          'timeout 5s ./program < input.txt; ' +
        'else ' +
          'timeout 5s ./program; ' +
        'fi';

      const { stdout, stderr } = await execAsync(
        `docker exec ${containerId} sh -c ${JSON.stringify(compileAndRunCmd)}`,
        { timeout: 10000 } // 10 second timeout
      );

      // 6️⃣ Return container to pool (reuse for next request)
      if (containerId) {
        await cppPool.returnContainer(containerId);
      }

      // 7️⃣ Cleanup temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }

      // 8️⃣ Process output
      if (stdout.startsWith("ERROR::")) {
        return resolve({ output: stdout.replace("ERROR::", "") });
      }

      resolve({ output: stdout || stderr });

    } catch (error) {
      console.error(`🔍 DEBUG runCppCode catch: error.message = "${error.message}"`);
      console.error(`🔍 DEBUG runCppCode catch: error.stack =`, error.stack?.substring(0, 200));
      // Return container to pool even on error
      if (containerId) {
        await cppPool.returnContainer(containerId).catch(() => {});
      }

      // Cleanup temp directory
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Handle timeout or other errors
      if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
        return resolve({ output: "Execution timeout: Code took too long to run" });
      }

      console.error(`🔍 DEBUG runCppCode: Resolving with error message: "${error.message}"`);
      resolve({ output: error.message || "Compilation/execution error" });
    }
  });
};
