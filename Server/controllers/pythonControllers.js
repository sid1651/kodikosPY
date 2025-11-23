import { runPythonInDocker } from "../services/dockerPythonRunner.js";
import fs from "fs";
import path from "path";

export const runPython = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "❗ No code provided" });
    }

    console.log("🔥 Running Python Code:\n", code);

    // Run Python → already returns images + tempDir
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
    fs.rmSync(tempDir, { recursive: true, force: true });

    return res.json({
      output,
      images: finalImages,
    });

  } catch (error) {
    console.error("🔥 Python Exec Error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
};
