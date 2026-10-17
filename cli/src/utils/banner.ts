import pc from "picocolors";

const KUJIRA_ART = [
  "██╗  ██╗██╗   ██╗     ██╗██╗██████╗  █████╗ ",
  "██║ ██╔╝██║   ██║     ██║██║██╔══██╗██╔══██╗",
  "█████╔╝ ██║   ██║     ██║██║██████╔╝███████║",
  "██╔═██╗ ██║   ██║██   ██║██║██╔══██╗██╔══██║",
  "██║  ██╗╚██████╔╝╚█████╔╝██║██║  ██║██║  ██║",
  "╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝",
] as const;

const TAGLINE = "The app people use to manage AI agents for work";

export function printPaperclipCliBanner(): void {
  const lines = [
    "",
    ...KUJIRA_ART.map((line) => pc.cyan(line)),
    pc.bold(pc.white("  Kujira AI Harness")),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
