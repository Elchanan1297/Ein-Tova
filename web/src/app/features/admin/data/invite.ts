/** קישורים אישיים והזמנה בוואטסאפ */

const TEMPLATE_KEY = 'eintova.admin.invite';

export const DEFAULT_TEMPLATE =
  'היי {שם}! 🎉\nביום ההולדת ה־70 של אבא יש משחק "70 עובדות שלא ידעתם על אבא".\nזה הקישור האישי שלך, פשוט לוחצים:\n{קישור}';

export function personalLink(code: string): string {
  return `${location.origin}/login?code=${encodeURIComponent(code)}`;
}

export function inviteText(template: string, name: string, code: string): string {
  return template.replaceAll('{שם}', name).replaceAll('{קישור}', personalLink(code));
}

/** 05XXXXXXXX → https://wa.me/9725XXXXXXXX?text=... */
export function whatsAppUrl(phone: string, text: string): string {
  const intl = '972' + phone.replace(/^0/, '');
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function readTemplate(): string {
  try {
    return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveTemplate(text: string): void {
  try {
    localStorage.setItem(TEMPLATE_KEY, text);
  } catch {
    // לא נורא: יחזור לנוסח ברירת המחדל
  }
}
