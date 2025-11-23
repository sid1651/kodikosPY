import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const runPythonInDocker = (userCode) => {
  return new Promise((resolve, reject) => {
    // 1️⃣ Wrap user code with imports and auto-save
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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "py-run-"));

    // 3️⃣ Run Docker container in detached mode
    const runCmd = `
      docker run -d -i \
         --network=none \
        --read-only \
        --pids-limit=20 \
        --memory=300m \
        --cpus=0.5 \
        --cap-drop=ALL \
        --security-opt no-new-privileges \
        -v ${tempDir}:/tmp \
        kodikos-python python3 /app/run.py
    `.trim();

    exec(runCmd, (err, containerId) => {
      if (err) return reject("❌ Docker start failed: " + err.message);

      containerId = containerId.trim();

      // 4️⃣ Execute Python code inside container using stdin
      const execCmd = `docker exec -i ${containerId} python3 /app/run.py`;
      const child = exec(execCmd, { timeout: 6000 }, async (execErr, stdout, stderr) => {

        // 5️⃣ Collect images from temp folder
        const outputFolder = path.join(tempDir, "output");
        let images = [];

        if (fs.existsSync(outputFolder)) {
          images = fs.readdirSync(outputFolder)
            .filter(f => f.endsWith(".png") || f.endsWith(".jpg"))
            .map(f => {
              const imgBuffer = fs.readFileSync(path.join(outputFolder, f));
              return {
                filename: f,
                data: `data:image/png;base64,${imgBuffer.toString("base64")}`
              };
            });
        }

        // 6️⃣ Stop + remove container
        exec(`docker rm -f ${containerId}`, () => {});

        // 7️⃣ Resolve output and images
        if (execErr) {
          return resolve({
            output: stderr || execErr.message,
            images: [],
            containerId,
          });
        }

        resolve({
          output: stdout.trim(),
          images,      // Base64 images ready for frontend
          containerId,
          tempDir
        });
      });

      // 8️⃣ Send wrapped code into container
      child.stdin.write(code);
      child.stdin.end();
    });
  });
};
