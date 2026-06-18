import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

export default function useDragClose(onClose: () => void, threshold = 120) {
  const panY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => panY.setValue(0),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > threshold) {
          Animated.timing(panY, { toValue: 500, duration: 200, useNativeDriver: true }).start(onCloseRef.current);
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        }
      },
    })
  ).current;

  return { panY, panHandlers: panResponder.panHandlers };
}
