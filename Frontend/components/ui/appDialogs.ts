"use client";

type ConfirmHandler = (message: string, title?: string) => Promise<boolean>;
type AlertHandler = (message: string, title?: string) => Promise<void>;

let confirmHandler: ConfirmHandler | null = null;
let alertHandler: AlertHandler | null = null;

export function registerAppDialogHandlers(handlers: {
  confirm: ConfirmHandler;
  alert: AlertHandler;
}) {
  confirmHandler = handlers.confirm;
  alertHandler = handlers.alert;
}

export function unregisterAppDialogHandlers() {
  confirmHandler = null;
  alertHandler = null;
}

export async function appConfirm(message: string, title?: string): Promise<boolean> {
  if (confirmHandler) return confirmHandler(message, title);
  return window.confirm(message);
}

export async function appAlert(message: string, title?: string): Promise<void> {
  if (alertHandler) return alertHandler(message, title);
  window.alert(message);
}
