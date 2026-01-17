
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { paths } from "../config/index.js";

export async function appendConversation(userText: string, reply: string) {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const stamp = d.toISOString();
  const dir = path.join(paths.CONV_DIR, yyyy, mm);
  await fs.mkdir(dir, { recursive: true });

  const file = path.join(dir, `${yyyy}-${mm}-${dd}.md`);
  const block = `
[${stamp}] USER: ${userText}
[${stamp}] WAYNE: ${reply}
`;
  await fs.appendFile(file, block, "utf8");
}
