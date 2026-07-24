export const ok = (res, data, meta) => {
  return res.json({ success: true, data, ...(meta ? { meta } : {}) });
};

export const created = (res, data, meta) => {
  return res.status(201).json({ success: true, data, ...(meta ? { meta } : {}) });
};

export const fail = (res, status, code, message, details) => {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) }
  });
};
