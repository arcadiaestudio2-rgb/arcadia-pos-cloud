

const DEVICE_ID_KEY = 'arcadia_device_id';
const DEVICE_NAME_KEY = 'arcadia_device_name';

export const DeviceService = {
  getDeviceId: (): string => {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `DEV-${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  },

  getDeviceName: (): string => {
    let name = localStorage.getItem(DEVICE_NAME_KEY);
    if (!name) {
      const userAgent = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
      name = isMobile ? 'Mobile POS' : 'Desktop POS';
      localStorage.setItem(DEVICE_NAME_KEY, name);
    }
    return name;
  },

  setDeviceName: (name: string) => {
    localStorage.setItem(DEVICE_NAME_KEY, name);
  }
};
