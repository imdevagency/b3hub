import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { CheckCircle } from 'lucide-react-native';

export function SearchingAnimation() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

    pulse(ring1, 0);
    pulse(ring2, 600);
    pulse(ring3, 1200);
    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
    };
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.25, 0] }),
  });

  return (
    <View style={s.ringContainer}>
      <Animated.View style={[s.ring, ringStyle(ring1)]} />
      <Animated.View style={[s.ring, ringStyle(ring2)]} />
      <Animated.View style={[s.ring, ringStyle(ring3)]} />
      <View style={s.ringCenter}>
        <CheckCircle size={28} color="#4ade80" strokeWidth={1.8} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ringContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#374151',
  },
  ringCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
