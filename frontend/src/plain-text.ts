/** Shared sink for all provider-controlled UI text. The rendered contract is plain text. */
export function setPlainText(element: HTMLElement, value: string): void {
  element.textContent = value;
}
