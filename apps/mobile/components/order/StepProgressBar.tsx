import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';

type Step = 1 | 2 | 3 | 4;

export function StepProgressBar({ step }: { step: Step }) {
  const anims = useRef([
    new Animated.Value(step === 1 ? 1 : 0.35),
    new Animated.Value(step === 2 ? 1 : step > 2 ? 0.55 : 0.2),
    new Animated.Value(step === 3 ? 1 : step > 3 ? 0.55 : 0.2),
    new Animated.Value(step === 4 ? 1 : 0.2),
  ]).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      const target = i + 1 === step ? 1 : i + 1 < step ? 0.55 : 0.2;
      Animated.spring(anim, {
        toValue: target,
        useNativeDriver: false,
        tension: 80,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 20, marginBottom: 10 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            height: 3,
            borderRadius: 2,
            flex: 1,
            backgroundColor: anim.interpolate({
              inputRange: [0.2, 0.55, 1],
              outputRange: ['#e5e7eb', '#9ca3af', '#111827'],
            }),
            opacity: anim.interpolate({
              inputRange: [0.2, 1],
              outputRange: [0.5, 1],
            }),
          }}
        />
      ))}
    </View>
  );
}
