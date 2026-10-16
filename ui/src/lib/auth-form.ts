export type EmailAuthMode = "sign_in" | "sign_up";

export type EmailAuthFieldError = "name" | "email" | "password" | "confirm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailAuthForm(input: {
  mode: EmailAuthMode;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): EmailAuthFieldError | null {
  if (input.mode === "sign_up" && input.name.trim().length === 0) return "name";
  if (!EMAIL_PATTERN.test(input.email.trim())) return "email";
  if (input.mode === "sign_in") {
    return input.password.length === 0 ? "password" : null;
  }
  if (input.password.length < 8) return "password";
  if (input.password !== input.confirmPassword) return "confirm";
  return null;
}
