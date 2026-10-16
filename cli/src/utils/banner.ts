import pc from "picocolors";

const RIKAI_ART = [
  "██████╗ ██╗██╗  ██╗ █████╗ ██╗",
  "██╔══██╗██║██║ ██╔╝██╔══██╗██║",
  "██████╔╝██║█████╔╝ ███████║██║",
  "██╔══██╗██║██╔═██╗ ██╔══██║██║",
  "██║  ██║██║██║  ██╗██║  ██║██║",
  "╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝",
] as const;

const TAGLINE = "The app people use to manage AI agents for work";

export function printPaperclipCliBanner(): void {
  const lines = [
    "",
    ...RIKAI_ART.map((line) => pc.cyan(line)),
    pc.bold(pc.white("  RIKAI AI Harness")),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
