import { executePythonCode } from "../services/executionServiceClient.js";

/**
 * Python code execution controller
 * Delegates execution to the separate code execution service
 */
export const runPython = async (req, res) => {
  try {
    const { code } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({ error: "❗ No code provided" });
    }

    console.log("🔥 Requesting Python execution from execution service");

    // Call execution service via HTTP
    const result = await executePythonCode(code);

    return res.json({
      output: result.output,
      images: result.images || [],
    });

  } catch (error) {
    console.error("🔥 Python Exec Error:", error);
    return res.status(500).json({ 
      error: "Server Error", 
      message: error.message || "Failed to execute Python code" 
    });
  }
};
