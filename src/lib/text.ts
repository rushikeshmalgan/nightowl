/** Decodes a text document as UTF-8 and drops a leading byte order mark. */
export async function readText(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
