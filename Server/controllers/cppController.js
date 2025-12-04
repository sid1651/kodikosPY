import { runCppCode } from "../services/dockercppRunner.js";

export const executeCpp = async (req, res) => {
  try {
    const { code, input } = req.body;
    console.log("input", input);

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const result = await runCppCode(code, input);
    return res.json(result);

  } catch (err) {
    console.error("C++ Execution Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
