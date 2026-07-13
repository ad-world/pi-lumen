import { spawn } from "node:child_process";

export type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export type ProcessRunner = (
  program: string,
  args: string[],
  cwd: string,
) => Promise<ProcessResult>;

export const defaultRunProcess: ProcessRunner = (program, args, cwd) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(program, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: null, stdout, stderr, error: error.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
