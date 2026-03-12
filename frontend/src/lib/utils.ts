export function parseHistoryField(field: any): any {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return { texto: field };
    }
  }
  return field;
}
