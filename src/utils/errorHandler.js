import Toast from 'react-native-toast-message';

export const parseError = (error) => {
  const msg    = typeof error === 'string' ? error : (error?.message || '');
  const status = error?.status;

  if (
    msg === 'Network Error' ||
    msg.toLowerCase().includes('network error') ||
    msg.toLowerCase().includes('network request failed')
  ) {
    return 'No internet connection. Please check your network.';
  }

  if (
    msg.toLowerCase().includes('timeout') ||
    msg.toLowerCase().includes('timed out') ||
    msg.toLowerCase().includes('econnaborted')
  ) {
    return 'Request timed out. Please try again.';
  }

  switch (status) {
    case 400: return msg || 'Invalid request. Please check your input.';
    case 401: return msg || 'Session expired. Please log in again.';
    case 403: return msg || "You don't have permission for this action.";
    case 404: return 'The requested item was not found.';
    case 408: return 'Request timed out. Please try again.';
    case 409: return msg || 'A conflict occurred. Please try again.';
    case 422: return msg || 'Invalid data submitted.';
    case 429: return msg || 'Too many attempts. Please wait a moment.';
    case 500: return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504: return 'Service temporarily unavailable. Please try again later.';
    default:  break;
  }

  if (msg && msg !== 'Something went wrong.') return msg;
  return 'Something went wrong. Please try again.';
};

export const showErrorToast = (error, title = 'Error') => {
  Toast.show({
    type:           'error',
    text1:          title,
    text2:          parseError(error),
    visibilityTime: 4000,
    position:       'top',
  });
};

export const showSuccessToast = (message, title = 'Done') => {
  Toast.show({
    type:           'success',
    text1:          title,
    text2:          message || undefined,
    visibilityTime: 3000,
    position:       'top',
  });
};

export const showInfoToast = (message, title = 'Info') => {
  Toast.show({
    type:           'info',
    text1:          title,
    text2:          message || undefined,
    visibilityTime: 3000,
    position:       'top',
  });
};
