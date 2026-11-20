export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length > 11 && digits.startsWith('55')) {
    return digits.slice(2, 13);
  }

  return digits.slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
  const digits = normalizeBrazilianPhone(value);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;

  const subscriberNumber = digits.slice(2);
  const firstGroupLength = digits.length <= 10 ? 4 : 5;
  const firstGroup = subscriberNumber.slice(0, firstGroupLength);
  const lastGroup = subscriberNumber.slice(firstGroupLength);

  return `(${digits.slice(0, 2)}) ${firstGroup}${lastGroup ? `-${lastGroup}` : ''}`;
}

export function isValidBrazilianPhone(value: string) {
  return /^\d{10,11}$/.test(normalizeBrazilianPhone(value));
}

export function formatBrazilianPostalCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatBrazilianPlateInput(value: string) {
  return value
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}
