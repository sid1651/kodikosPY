import { runPythonInDocker } from "../services/dockerPythonRunner.js";

export const runPython = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "❗ No code provided" });
    }

    const output = await runPythonInDocker(code);
    return res.json({ output });

  } catch (error) {
    console.error("🔥 Python Exec Error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
};
