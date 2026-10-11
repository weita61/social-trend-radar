import type { CrawlerPlatform } from './types.ts';

export const allowedAutomationActions = [
  'navigate',
  'read_visible',
  'scroll',
  'wait',
  'capture',
  'stop',
] as const;

export type AllowedAutomationAction = (typeof allowedAutomationActions)[number];

export class ForbiddenAutomationActionError extends Error {
  readonly code = 'forbidden_automation_action';
  readonly action: string;

  constructor(action: string) {
    super(`Automation action is not allowed: ${action}`);
    this.action = action;
  }
}

export class AutomationStopError extends Error {
  readonly code: 'login_required' | 'challenge_detected' | 'kill_switch_enabled';

  constructor(code: AutomationStopError['code']) {
    super(code);
    this.code = code;
  }
}

export function assertAllowedAutomationAction(action: string): asserts action is AllowedAutomationAction {
  if (!(allowedAutomationActions as readonly string[]).includes(action)) {
    throw new ForbiddenAutomationActionError(action);
  }
}

export function detectStopReason(
  platform: CrawlerPlatform,
  pageUrl: string,
  visibleText: string,
): AutomationStopError['code'] | null {
  const normalizedUrl = pageUrl.toLowerCase();
  const normalizedText = visibleText.toLowerCase();
  const loginUrl = platform === 'instagram'
    ? normalizedUrl.includes('/accounts/login')
    : normalizedUrl.includes('/login');
  if (loginUrl) return 'login_required';

  const challengeUrl = normalizedUrl.includes('/challenge')
    || normalizedUrl.includes('/captcha')
    || normalizedUrl.includes('/verify');
  const challengeText = normalizedText.includes('captcha')
    || normalizedText.includes('セキュリティチェック')
    || normalizedText.includes('本人確認')
    || normalizedText.includes('verify you are human');
  return challengeUrl || challengeText ? 'challenge_detected' : null;
}
