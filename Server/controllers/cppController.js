import { executeCppCode } from "../services/executionServiceClient.js";

/**
 * C++ code execution controller
 * Delegates execution to the separate code execution service
 */
export const executeCpp = async (req, res) => {
  try {
    const { code, input } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    console.log("🔥 Requesting C++ execution from execution service");
    if (input) {
      console.log("Input:", input);
    }

    // Call execution service via HTTP
    const result = await executeCppCode(code, input);
    return res.json(result);

  } catch (err) {
    console.error("C++ Execution Error:", err);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: err.message || "Failed to execute C++ code" 
    });
  }
};
