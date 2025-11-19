import { exec } from "child_process";

export const runPythonInDocker = (code) => {
  return new Promise((resolve, reject) => {
    const command = `docker run --rm -i kodikos-python python3 /app/run.py`;

    const process = exec(command, { timeout: 5000 }, (err, stdout, stderr) => {

      console.log("---- DOCKER LOGS ----");
      console.log("ERR:", err);
      console.log("STDERR:", stderr);
      console.log("STDOUT:", stdout);
      console.log("----------------------");

      if (err) {
        return resolve(`❌ Error: ${stderr || err.message}`);
      }

      resolve(stdout.trim());
    });

    process.stdin.write(code);
    process.stdin.end();
  });
};
