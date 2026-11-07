import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface EditorOptions {
  /** Shell command of the editor; the file path is appended as argument. */
  readonly command: string;
  /** Text shown in the file; lines starting with "#" are removed afterwards. */
  readonly template: string;
}

/** The user's editor: $VISUAL, then $EDITOR, then vi. */
export function defaultEditor(env: NodeJS.ProcessEnv): string {
  return env["VISUAL"] ?? env["EDITOR"] ?? "vi";
}

function quote(path: string): string {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

function waitForEditor(command: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(`${command} ${quote(file)}`, {
      shell: true,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`Editor "${command}" exited with code ${String(code)}`),
        );
    });
  });
}

/** Opens a temporary file in the editor and returns the text without comments. */
export async function editText(options: EditorOptions): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "conductor-feedback-"));
  const file = join(directory, "FEEDBACK.md");
  try {
    await writeFile(file, options.template);
    await waitForEditor(options.command, file);
    const text = await readFile(file, "utf8");
    return text
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n")
      .trim();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
