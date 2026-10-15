import { useEffect, useState } from 'react';

import { localKv } from './localKv';

/** One-time dismissible UI flag (e.g. the welcome card). */
export function useDismissible(key: string): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let alive = true;
    localKv
      .getItem(key)
      .then((v) => alive && setVisible(v !== '1'))
      .catch(() => alive && setVisible(false));
    return () => {
      alive = false;
    };
  }, [key]);
  return {
    visible,
    dismiss: () => {
      setVisible(false);
      void localKv.setItem(key, '1');
    },
  };
}
