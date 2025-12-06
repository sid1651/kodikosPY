import { runPythonInDocker } from "../services/dockerPythonRunner.js";
import { runCppCode } from "../services/dockercppRunner.js";
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

    // Runner already handles temp dirs and image extraction
    const { output, images = [] } = await runPythonInDocker(code);

    return res.json({
      output,
      images,
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
  process.stdout.write(`🔍 DEBUG executeCpp START: code=${req.body?.code?.substring(0, 20)}...\n`);
  try {
    const { code, input } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    process.stdout.write(`🔥 Running C++ Code\n`);
    if (input) {
      process.stdout.write(`Input: ${input}\n`);
    }

    // Execute C++ code
    process.stdout.write(`🔍 DEBUG executeCpp: About to call runCppCode\n`);
    const result = await runCppCode(code, input);
    process.stdout.write(`🔍 DEBUG executeCpp: runCppCode returned: ${JSON.stringify(result).substring(0, 100)}\n`);
    return res.json(result);

  } catch (err) {
    console.error("C++ Execution Error:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};
