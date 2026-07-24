import { devices } from "../store.js";

export const findDevice = (deviceId) => devices.find((device) => device.id === deviceId);

export const listDevices = ({ status } = {}) => {
  if (!status) return devices;
  return devices.filter((device) => device.status === status);
};

export const findPump = (deviceId, pumpId) => {
  const device = findDevice(deviceId);
  if (!device) return { device: null, pump: null };

  const pump = device.pumps.find((item) => item.id === pumpId);
  return { device, pump };
};
