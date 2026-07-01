import parseArgsStringToArgv from "string-argv";

export type LumenCommand = {
  program: "lumen";
  args: string[];
  display: string;
};

/** Build the only command this package supports: `lumen diff ...`. */
export function diffCommand(input: string): LumenCommand {
  const args = parseArgsStringToArgv(input.trim());
  if (args[0] === "diff") args.shift();

  const fullArgs = ["diff", ...args];
  return { program: "lumen", args: fullArgs, display: `lumen ${fullArgs.join(" ")}` };
}
