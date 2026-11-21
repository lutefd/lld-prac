import type * as monaco from "monaco-editor";

export type EditorThemeId =
  | "auto"
  | "practice-dark"
  | "practice-light"
  | "monokai"
  | "dracula"
  | "one-dark"
  | "nord"
  | "github-dark"
  | "github-light"
  | "solarized-dark"
  | "solarized-light";

export type EditorFontId =
  | "system-mono"
  | "ibm-plex-mono"
  | "menlo"
  | "jetbrains-mono"
  | "fira-code";

export const editorThemeOptions: {
  id: Exclude<EditorThemeId, "auto">;
  label: string;
  data: monaco.editor.IStandaloneThemeData;
}[] = [
  {
    id: "practice-dark",
    label: "Workbench Dark",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "748178", fontStyle: "italic" },
        { token: "keyword", foreground: "C6ADFA" },
        { token: "string", foreground: "B5CE9A" },
        { token: "number", foreground: "E9BD86" },
        { token: "type.identifier", foreground: "8BC8C0" },
      ],
      colors: {
        "editor.background": "#171a1f",
        "editor.foreground": "#CDD2D9",
        "editorLineNumber.foreground": "#525965",
        "editorLineNumber.activeForeground": "#ACB6C3",
        "editor.lineHighlightBackground": "#1D2128",
        "editor.selectionBackground": "#334838",
        "editorCursor.foreground": "#B9E787",
        "editorIndentGuide.background1": "#272D34",
        "editorWidget.background": "#20252C",
        "editorWidget.foreground": "#CDD2D9",
        "editorWidget.border": "#343B44",
        "editorSuggestWidget.background": "#20252C",
        "editorSuggestWidget.border": "#343B44",
        "editorSuggestWidget.foreground": "#CDD2D9",
        "editorSuggestWidget.highlightForeground": "#EEA06C",
        "editorSuggestWidget.selectedBackground": "#344434",
        "editorSuggestWidget.selectedForeground": "#FFFFFF",
        "editorSuggestWidget.selectedIconForeground": "#FFFFFF",
        "editorSuggestWidget.focusHighlightForeground": "#F5B88E",
      },
    },
  },
  {
    id: "practice-light",
    label: "Workbench Light",
    data: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "647567", fontStyle: "italic" },
        { token: "keyword", foreground: "7544A0" },
        { token: "string", foreground: "427022" },
        { token: "number", foreground: "986013" },
        { token: "type.identifier", foreground: "21736D" },
      ],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#29333F",
        "editorLineNumber.foreground": "#8A95A1",
        "editorLineNumber.activeForeground": "#445160",
        "editor.lineHighlightBackground": "#F4F6F8",
        "editor.selectionBackground": "#D5E6D5",
        "editorCursor.foreground": "#39704A",
        "editorIndentGuide.background1": "#E3E7EB",
        "editorWidget.background": "#FFFFFF",
        "editorWidget.foreground": "#29333F",
        "editorWidget.border": "#CDD4DC",
        "editorSuggestWidget.background": "#FFFFFF",
        "editorSuggestWidget.border": "#CDD4DC",
        "editorSuggestWidget.foreground": "#29333F",
        "editorSuggestWidget.highlightForeground": "#A9501D",
        "editorSuggestWidget.selectedBackground": "#CFE3D3",
        "editorSuggestWidget.selectedForeground": "#182331",
        "editorSuggestWidget.selectedIconForeground": "#182331",
        "editorSuggestWidget.focusHighlightForeground": "#8D4015",
        "list.hoverBackground": "#EEF2F6",
      },
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "88846F", fontStyle: "italic" },
        { token: "keyword", foreground: "F92672" },
        { token: "string", foreground: "E6DB74" },
        { token: "number", foreground: "AE81FF" },
        { token: "type.identifier", foreground: "66D9EF", fontStyle: "italic" },
        { token: "identifier", foreground: "F8F8F2" },
        { token: "delimiter", foreground: "F8F8F2" },
      ],
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#F8F8F2",
        "editorLineNumber.foreground": "#75715E",
        "editorLineNumber.activeForeground": "#C2C2BF",
        "editor.lineHighlightBackground": "#3E3D32",
        "editor.selectionBackground": "#49483E",
        "editorCursor.foreground": "#F8F8F0",
        "editorIndentGuide.background1": "#464741",
        "editorWidget.background": "#1E1F1C",
        "editorWidget.foreground": "#F8F8F2",
        "editorWidget.border": "#49483E",
        "editorSuggestWidget.background": "#1E1F1C",
        "editorSuggestWidget.border": "#49483E",
        "editorSuggestWidget.foreground": "#F8F8F2",
        "editorSuggestWidget.highlightForeground": "#A6E22E",
        "editorSuggestWidget.selectedBackground": "#414339",
        "editorSuggestWidget.selectedForeground": "#FFFFFF",
        "editorSuggestWidget.selectedIconForeground": "#FFFFFF",
        "editorSuggestWidget.focusHighlightForeground": "#A6E22E",
      },
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272A4", fontStyle: "italic" },
        { token: "keyword", foreground: "FF79C6" },
        { token: "string", foreground: "F1FA8C" },
        { token: "number", foreground: "BD93F9" },
        { token: "type.identifier", foreground: "8BE9FD", fontStyle: "italic" },
        { token: "identifier", foreground: "F8F8F2" },
      ],
      colors: {
        "editor.background": "#282A36",
        "editor.foreground": "#F8F8F2",
        "editorLineNumber.foreground": "#6272A4",
        "editorLineNumber.activeForeground": "#F8F8F2",
        "editor.lineHighlightBackground": "#44475A75",
        "editor.selectionBackground": "#44475A",
        "editorCursor.foreground": "#F8F8F2",
        "editorIndentGuide.background1": "#424450",
        "editorWidget.background": "#21222C",
        "editorWidget.foreground": "#F8F8F2",
        "editorWidget.border": "#44475A",
        "editorSuggestWidget.background": "#21222C",
        "editorSuggestWidget.border": "#44475A",
        "editorSuggestWidget.foreground": "#F8F8F2",
        "editorSuggestWidget.highlightForeground": "#8BE9FD",
        "editorSuggestWidget.selectedBackground": "#44475A",
        "editorSuggestWidget.selectedForeground": "#FFFFFF",
        "editorSuggestWidget.selectedIconForeground": "#FFFFFF",
        "editorSuggestWidget.focusHighlightForeground": "#50FA7B",
      },
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7F848E", fontStyle: "italic" },
        { token: "keyword", foreground: "C678DD" },
        { token: "string", foreground: "98C379" },
        { token: "number", foreground: "D19A66" },
        { token: "type.identifier", foreground: "E5C07B" },
        { token: "identifier", foreground: "ABB2BF" },
      ],
      colors: {
        "editor.background": "#282C34",
        "editor.foreground": "#ABB2BF",
        "editorLineNumber.foreground": "#4B5263",
        "editorLineNumber.activeForeground": "#ABB2BF",
        "editor.lineHighlightBackground": "#2C313C",
        "editor.selectionBackground": "#3E4451",
        "editorCursor.foreground": "#528BFF",
        "editorIndentGuide.background1": "#3B4048",
        "editorWidget.background": "#21252B",
        "editorWidget.foreground": "#ABB2BF",
        "editorWidget.border": "#3E4451",
        "editorSuggestWidget.background": "#21252B",
        "editorSuggestWidget.border": "#3E4451",
        "editorSuggestWidget.foreground": "#ABB2BF",
        "editorSuggestWidget.highlightForeground": "#61AFEF",
        "editorSuggestWidget.selectedBackground": "#323842",
        "editorSuggestWidget.selectedForeground": "#FFFFFF",
        "editorSuggestWidget.selectedIconForeground": "#FFFFFF",
        "editorSuggestWidget.focusHighlightForeground": "#61AFEF",
      },
    },
  },
  {
    id: "nord",
    label: "Nord",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "616E88", fontStyle: "italic" },
        { token: "keyword", foreground: "81A1C1" },
        { token: "string", foreground: "A3BE8C" },
        { token: "number", foreground: "B48EAD" },
        { token: "type.identifier", foreground: "8FBCBB" },
        { token: "identifier", foreground: "D8DEE9" },
      ],
      colors: {
        "editor.background": "#2E3440",
        "editor.foreground": "#D8DEE9",
        "editorLineNumber.foreground": "#4C566A",
        "editorLineNumber.activeForeground": "#D8DEE9",
        "editor.lineHighlightBackground": "#3B4252",
        "editor.selectionBackground": "#434C5E",
        "editorCursor.foreground": "#D8DEE9",
        "editorIndentGuide.background1": "#434C5E",
        "editorWidget.background": "#2E3440",
        "editorWidget.foreground": "#D8DEE9",
        "editorWidget.border": "#4C566A",
        "editorSuggestWidget.background": "#2E3440",
        "editorSuggestWidget.border": "#4C566A",
        "editorSuggestWidget.foreground": "#D8DEE9",
        "editorSuggestWidget.highlightForeground": "#88C0D0",
        "editorSuggestWidget.selectedBackground": "#434C5E",
        "editorSuggestWidget.selectedForeground": "#ECEFF4",
        "editorSuggestWidget.selectedIconForeground": "#ECEFF4",
        "editorSuggestWidget.focusHighlightForeground": "#88C0D0",
      },
    },
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8B949E", fontStyle: "italic" },
        { token: "keyword", foreground: "FF7B72" },
        { token: "string", foreground: "A5D6FF" },
        { token: "number", foreground: "79C0FF" },
        { token: "type.identifier", foreground: "FFA657" },
        { token: "identifier", foreground: "E6EDF3" },
      ],
      colors: {
        "editor.background": "#0D1117",
        "editor.foreground": "#E6EDF3",
        "editorLineNumber.foreground": "#6E7681",
        "editorLineNumber.activeForeground": "#E6EDF3",
        "editor.lineHighlightBackground": "#161B22",
        "editor.selectionBackground": "#264F78",
        "editorCursor.foreground": "#58A6FF",
        "editorIndentGuide.background1": "#21262D",
        "editorWidget.background": "#161B22",
        "editorWidget.foreground": "#E6EDF3",
        "editorWidget.border": "#30363D",
        "editorSuggestWidget.background": "#161B22",
        "editorSuggestWidget.border": "#30363D",
        "editorSuggestWidget.foreground": "#E6EDF3",
        "editorSuggestWidget.highlightForeground": "#58A6FF",
        "editorSuggestWidget.selectedBackground": "#1F3A5F",
        "editorSuggestWidget.selectedForeground": "#FFFFFF",
        "editorSuggestWidget.selectedIconForeground": "#FFFFFF",
        "editorSuggestWidget.focusHighlightForeground": "#79C0FF",
      },
    },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    data: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6E7781", fontStyle: "italic" },
        { token: "keyword", foreground: "CF222E" },
        { token: "string", foreground: "0A3069" },
        { token: "number", foreground: "0550AE" },
        { token: "type.identifier", foreground: "953800" },
        { token: "identifier", foreground: "24292F" },
      ],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#24292F",
        "editorLineNumber.foreground": "#8C959F",
        "editorLineNumber.activeForeground": "#24292F",
        "editor.lineHighlightBackground": "#F6F8FA",
        "editor.selectionBackground": "#B6E3FF",
        "editorCursor.foreground": "#0969DA",
        "editorIndentGuide.background1": "#D8DEE4",
        "editorWidget.background": "#FFFFFF",
        "editorWidget.foreground": "#24292F",
        "editorWidget.border": "#D0D7DE",
        "editorSuggestWidget.background": "#FFFFFF",
        "editorSuggestWidget.border": "#D0D7DE",
        "editorSuggestWidget.foreground": "#24292F",
        "editorSuggestWidget.highlightForeground": "#0969DA",
        "editorSuggestWidget.selectedBackground": "#DDF4FF",
        "editorSuggestWidget.selectedForeground": "#1F2328",
        "editorSuggestWidget.selectedIconForeground": "#1F2328",
        "editorSuggestWidget.focusHighlightForeground": "#0550AE",
        "list.hoverBackground": "#F3F4F6",
      },
    },
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    data: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "586E75", fontStyle: "italic" },
        { token: "keyword", foreground: "859900" },
        { token: "string", foreground: "2AA198" },
        { token: "number", foreground: "D33682" },
        { token: "type.identifier", foreground: "B58900" },
        { token: "identifier", foreground: "839496" },
      ],
      colors: {
        "editor.background": "#002B36",
        "editor.foreground": "#839496",
        "editorLineNumber.foreground": "#586E75",
        "editorLineNumber.activeForeground": "#93A1A1",
        "editor.lineHighlightBackground": "#073642",
        "editor.selectionBackground": "#073642",
        "editorCursor.foreground": "#D30102",
        "editorIndentGuide.background1": "#073642",
        "editorWidget.background": "#073642",
        "editorWidget.foreground": "#93A1A1",
        "editorWidget.border": "#586E75",
        "editorSuggestWidget.background": "#073642",
        "editorSuggestWidget.border": "#586E75",
        "editorSuggestWidget.foreground": "#93A1A1",
        "editorSuggestWidget.highlightForeground": "#2AA198",
        "editorSuggestWidget.selectedBackground": "#144B5A",
        "editorSuggestWidget.selectedForeground": "#FDF6E3",
        "editorSuggestWidget.selectedIconForeground": "#FDF6E3",
        "editorSuggestWidget.focusHighlightForeground": "#2AA198",
      },
    },
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    data: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "93A1A1", fontStyle: "italic" },
        { token: "keyword", foreground: "859900" },
        { token: "string", foreground: "2AA198" },
        { token: "number", foreground: "D33682" },
        { token: "type.identifier", foreground: "B58900" },
        { token: "identifier", foreground: "657B83" },
      ],
      colors: {
        "editor.background": "#FDF6E3",
        "editor.foreground": "#657B83",
        "editorLineNumber.foreground": "#93A1A1",
        "editorLineNumber.activeForeground": "#586E75",
        "editor.lineHighlightBackground": "#EEE8D5",
        "editor.selectionBackground": "#EEE8D5",
        "editorCursor.foreground": "#657B83",
        "editorIndentGuide.background1": "#EEE8D5",
        "editorWidget.background": "#FDF6E3",
        "editorWidget.foreground": "#586E75",
        "editorWidget.border": "#D3CBB8",
        "editorSuggestWidget.background": "#FDF6E3",
        "editorSuggestWidget.border": "#D3CBB8",
        "editorSuggestWidget.foreground": "#586E75",
        "editorSuggestWidget.highlightForeground": "#CB4B16",
        "editorSuggestWidget.selectedBackground": "#DDD6C1",
        "editorSuggestWidget.selectedForeground": "#073642",
        "editorSuggestWidget.selectedIconForeground": "#073642",
        "editorSuggestWidget.focusHighlightForeground": "#B54110",
        "list.hoverBackground": "#EEE8D5",
      },
    },
  },
];

export const editorFontOptions: {
  id: EditorFontId;
  label: string;
  family: string;
}[] = [
  {
    id: "system-mono",
    label: "System Mono",
    family: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    family: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  },
  {
    id: "menlo",
    label: "Menlo / Monaco",
    family: 'Menlo, Monaco, Consolas, "IBM Plex Mono", monospace',
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    family: '"JetBrains Mono", "IBM Plex Mono", monospace',
  },
  {
    id: "fira-code",
    label: "Fira Code",
    family: '"Fira Code", "IBM Plex Mono", monospace',
  },
];

export function fontFamilyFor(id: EditorFontId): string {
  return (
    editorFontOptions.find((option) => option.id === id)?.family ??
    editorFontOptions[0].family
  );
}

export function registerEditorThemes(monacoApi: typeof monaco) {
  for (const theme of editorThemeOptions) {
    monacoApi.editor.defineTheme(theme.id, theme.data);
  }
}
