import { useCallback, useEffect, useState } from 'react';
import { getPermission, requestPermission, watchPermission, type PermissionStatus } from './system';

/** Browser notification permission plus a function to request it. */
export function usePermission(): {
  permission: PermissionStatus;
  request: () => Promise<PermissionStatus>;
} {
  const [permission, setPermission] = useState<PermissionStatus>(() => getPermission());
  useEffect(() => watchPermission(setPermission), []);
  const request = useCallback(async () => {
    const result = await requestPermission();
    setPermission(result);
    return result;
  }, []);
  return { permission, request };
}
