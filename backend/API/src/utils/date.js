export const parseDate = (value, field) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} must be a valid ISO date.`);
    error.status = 400;
    error.code = "INVALID_DATE";
    throw error;
  }

  return date;
};

export const getDayRange = (value) => {
  const date = parseDate(value || new Date().toISOString().slice(0, 10), "date");
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { date, start, end };
};
