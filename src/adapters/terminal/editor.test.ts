import { describe, expect, it } from "vitest";

import { defaultEditor, editText } from "./editor.js";

describe("defaultEditor", () => {
  it("prefers VISUAL, then EDITOR, then vi", () => {
    expect(defaultEditor({ VISUAL: "code --wait", EDITOR: "nano" })).toBe(
      "code --wait",
    );
    expect(defaultEditor({ EDITOR: "nano" })).toBe("nano");
    expect(defaultEditor({})).toBe("vi");
  });
});

describe("editText", () => {
  it("returns the edited text without comment lines", async () => {
    const text = await editText({
      command: `printf '# hint\\nAdd CSV export.\\n\\n' >>`,
      template: "# Describe the changes\n",
    });
    expect(text).toBe("Add CSV export.");
  });

  it("fails when the editor fails", async () => {
    await expect(editText({ command: "false", template: "" })).rejects.toThrow(
      /Editor "false" exited with code 1/,
    );
  });
});
