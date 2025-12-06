import { runPythonInDocker } from "../services/dockerPythonRunner.js";
import { runCppCode } from "../services/dockercppRunner.js";
import fs from "fs";
import path from "path";

/**
 * Execute Python code and return output with images
 * Handles matplotlib figure generation and cleanup
 */
export const executePython = async (req, res) => {
  try {
    const { code } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({ error: "❗ No code provided" });
    }

    console.log("🔥 Running Python Code:\n", code);

    // Run Python → returns images + tempDir
    const { output, images, tempDir } = await runPythonInDocker(code);

    const outputFolder = path.join(tempDir, "output");
    let finalImages = [];

    // Convert images to Base64
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
          finalImages.push({
            filename: file,
            data: `data:image/png;base64,${imgBuffer.toString("base64")}`,
          });
        }
      }
    }

    // Cleanup temp directory
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }

    return res.json({
      output,
      images: finalImages,
    });

  } catch (error) {
    console.error("🔥 Python Exec Error:", error);
    return res.status(500).json({ error: "Server Error", message: error.message });
  }
};

/**
 * Execute C++ code and return output
 * Handles compilation and execution with optional input
 */
export const executeCpp = async (req, res) => {
  try {
    const { code, input } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    console.log("🔥 Running C++ Code");
    if (input) {
      console.log("Input:", input);
    }

    // Execute C++ code
    const result = await runCppCode(code, input);
    return res.json(result);

  } catch (err) {
    console.error("C++ Execution Error:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};

