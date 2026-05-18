let toastHandler = null;

export const registerToastHandler = (handler) => {
  toastHandler = handler;
  return () => {
    if (toastHandler === handler) {
      toastHandler = null;
    }
  };
};

export const showToast = (message, type = 'success', duration = 3500) => {
  if (toastHandler) {
    toastHandler(message, type, duration);
  }
};
