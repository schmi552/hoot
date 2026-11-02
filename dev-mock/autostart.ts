let on = true;
export const isEnabled = async () => on;
export const enable = async () => void (on = true);
export const disable = async () => void (on = false);
