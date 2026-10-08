import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";

// CSV has no mainstream CodeMirror 6 grammar; it renders as plain text.
export function languageForExt(ext: string): Extension | null {
  switch (ext) {
    case "md":
    case "markdown":
      return markdown();
    case "json":
    case "jsonc":
      return json();
    case "js":
    case "mjs":
    case "cjs":
      return javascript();
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
      return javascript({ typescript: true });
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "py":
      return python();
    case "rs":
      return rust();
    case "go":
      return go();
    case "yaml":
    case "yml":
      return yaml();
    case "toml":
      return StreamLanguage.define(toml);
    case "xml":
      return xml();
    case "html":
    case "htm":
      return html();
    case "css":
      return css();
    case "sql":
      return sql();
    default:
      return null;
  }
}
