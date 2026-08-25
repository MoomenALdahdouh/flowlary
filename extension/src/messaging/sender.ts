/** Accept messages only from this extension's own contexts. */
export function isTrustedExtensionSender(
  sender: chrome.runtime.MessageSender | undefined,
): boolean {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return true
  if (!sender?.id) return false
  return sender.id === chrome.runtime.id
}
