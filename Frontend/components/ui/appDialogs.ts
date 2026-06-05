"use client";

export type AppDialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  defaultValue?: string;
  placeholder?: string;
};

type ConfirmHandler = (message: string, options?: AppDialogOptions) => Promise<boolean>;
type AlertHandler = (message: string, options?: AppDialogOptions) => Promise<void>;
type PromptHandler = (message: string, options?: AppDialogOptions) => Promise<string | null>;

let confirmHandler: ConfirmHandler | null = null;
let alertHandler: AlertHandler | null = null;
let promptHandler: PromptHandler | null = null;

function normalizeOptions(options?: string | AppDialogOptions): AppDialogOptions {
  if (typeof options === "string") return { title: options };
  return options ?? {};
}

export function registerAppDialogHandlers(handlers: {
  confirm: ConfirmHandler;
  alert: AlertHandler;
  prompt: PromptHandler;
}) {
  confirmHandler = handlers.confirm;
  alertHandler = handlers.alert;
  promptHandler = handlers.prompt;
}

export function unregisterAppDialogHandlers() {
  confirmHandler = null;
  alertHandler = null;
  promptHandler = null;
}

export async function appConfirm(message: string, options?: string | AppDialogOptions): Promise<boolean> {
  if (confirmHandler) return confirmHandler(message, normalizeOptions(options));
  return window.confirm(message);
}

export async function appAlert(message: string, options?: string | AppDialogOptions): Promise<void> {
  if (alertHandler) return alertHandler(message, normalizeOptions(options));
  window.alert(message);
}

export async function appPrompt(message: string, options?: string | AppDialogOptions): Promise<string | null> {
  if (promptHandler) return promptHandler(message, normalizeOptions(options));
  return window.prompt(message, normalizeOptions(options).defaultValue ?? undefined);
}
