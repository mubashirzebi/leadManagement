export const extractError = (err: any): string => {
  if (typeof err === 'string') return err;
  const msg = err.response?.data?.message || err.response?.data?.error;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.join('\n');
  if (err.response?.data?.errors) {
    const e = err.response.data.errors;
    if (Array.isArray(e)) return e.map((x: any) => x.msg || x.message || x).join('\n');
    if (typeof e === 'object') return Object.values(e).join('\n');
  }
  return err.message || 'Something went wrong';
};
