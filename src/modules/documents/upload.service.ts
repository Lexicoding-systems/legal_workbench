import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function saveUploadedFile(
  matterId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const matterDir = path.join(process.cwd(), UPLOAD_DIR, matterId);
  await fs.mkdir(matterDir, { recursive: true });

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${uuidv4()}-${safeName}`;
  const filePath = path.join(matterDir, storedName);

  await fs.writeFile(filePath, buffer);
  return filePath;
}
