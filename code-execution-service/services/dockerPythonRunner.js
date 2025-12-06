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

// Create Python container pool
// Pool size can be configured via environment variable
const PYTHON_POOL_SIZE = parseInt(process.env.PYTHON_POOL_SIZE || "5", 10);

// Use Docker Hub image: sidhu1651/kodikos-python
const PYTHON_IMAGE = process.env.PYTHON_DOCKER_IMAGE || "sidhu1651/kodikos-python";

console.log(`🔧 Python Pool using image: ${PYTHON_IMAGE}`);

const pythonPool = new ContainerPool(PYTHON_IMAGE, PYTHON_POOL_SIZE, {
  cmd: "python3 /app/run.py",
  readOnly: false, // Matplotlib/image generation needs a writable /tmp
});

/**
 * Initialize Python container pool on service startup
 * Pre-warms containers to eliminate cold start delays
 */
export const initializePythonPool = async () => {
  await pythonPool.initialize();
};

/**
 * Get Python pool statistics
 */
export const getPythonPoolStats = () => {
  return pythonPool.getStats();
};

/**
 * Run Python code in Docker container using pool
 * Reuses warm containers for fast execution
 * @param {string} userCode - The Python code to execute
 * @returns {Promise<{output: string, images: Array, tempDir: string}>}
 */
export const runPythonInDocker = (userCode) => {
  return new Promise(async (resolve, reject) => {
    let containerId = null;
    let tempDir = null;

    try {
      // 1️⃣ Wrap user code with imports and auto-save matplotlib figures
      const prefix = `
import os
import matplotlib.pyplot as plt

TEMP_DIR = "/tmp/output"
os.makedirs(TEMP_DIR, exist_ok=True)
`;

      const suffix = `
for i, fig_num in enumerate(plt.get_fignums()):
    fig = plt.figure(fig_num)
    fig.savefig(os.path.join(TEMP_DIR, f"figure_{i+1}.png"))
`;

      const code = prefix + "\n" + userCode + "\n" + suffix;

      // 2️⃣ Create temp folder for Docker mount
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "py-run-"));

      // 3️⃣ Get container from pool (FAST - no cold start!)
      containerId = await pythonPool.getContainer();

      // 4️⃣ Execute Python code inside container using stdin
      // Code will save images to /tmp/output inside container
      const execCmd = `docker exec -i ${containerId} python3 /app/run.py`;
      const child = exec(execCmd, { timeout: 6000 }, async (execErr, stdout, stderr) => {
        // 6️⃣ Collect images from container
        // Copy output directory from container to host temp directory
        const outputFolder = path.join(tempDir, "output");
        let images = [];

        // Copy output directory from container to host temp directory
        try {
          await execAsync(`docker cp ${containerId}:/tmp/output ${tempDir}/ 2>/dev/null || mkdir -p ${outputFolder}`);
        } catch (copyError) {
          // Create output folder if copy fails
          try {
            fs.mkdirSync(outputFolder, { recursive: true });
          } catch (mkdirError) {
            // Ignore
          }
        }

        if (fs.existsSync(outputFolder)) {
          const files = fs.readdirSync(outputFolder);
          for (const file of files) {
            const filePath = path.join(outputFolder, file);
            if (
              file.endsWith(".png") ||
              file.endsWith(".jpg") ||
              file.endsWith(".jpeg")
            ) {
              const imgBuffer = fs.readFileSync(filePath);
              images.push({
                filename: file,
                data: `data:image/png;base64,${imgBuffer.toString("base64")}`,
              });
            }
          }
        }

        // 7️⃣ Return container to pool (reuse for next request)
        if (containerId) {
          await pythonPool.returnContainer(containerId);
        }

        // 8️⃣ Cleanup temp directory
        if (tempDir) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }

        // 9️⃣ Resolve output and images
        if (execErr) {
          return resolve({
            output: stderr || execErr.message,
            images: [],
          });
        }

        resolve({
          output: stdout.trim(),
          images,
        });
      });

      // 🔟 Send wrapped code into container
      child.stdin.write(code);
      child.stdin.end();

    } catch (error) {
      // Return container to pool even on error
      if (containerId) {
        await pythonPool.returnContainer(containerId).catch(() => {});
      }

      // Cleanup temp directory
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      reject(error);
    }
  });
};
