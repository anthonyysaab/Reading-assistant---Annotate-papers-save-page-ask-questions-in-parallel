import { readBodyLines } from "./http";

export interface SseEvent {
  event?: string;
  data: string;
}

export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<SseEvent> {
  let dataLines: string[] = [];
  let event: string | undefined;

  for await (const line of readBodyLines(body, signal)) {
    if (line === "") {
      if (dataLines.length > 0) yield { event, data: dataLines.join("\n") };
      dataLines = [];
      event = undefined;
      continue;
    }
    if (line.startsWith(":")) continue;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length > 0) yield { event, data: dataLines.join("\n") };
}
