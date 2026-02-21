export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  command?: string; // If the AI suggests a terminal command
}

export interface TerminalCommand {
  command: string;
  cwd: string;
}

export interface TerminalOutput {
  type: "stdout" | "stderr" | "exit" | "error";
  data: string;
}
