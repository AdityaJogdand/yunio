import { Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Palette: black and white; colour only means status (always paired with a word)
export const BLACK = '#000000';
export const WHITE = '#FFFFFF';
export const MUTED = 'rgba(255,255,255,0.6)';
export const QUIET = 'rgba(255,255,255,0.42)';
export const TRACK = 'rgba(255,255,255,0.1)';
export const RIM = 'rgba(255,255,255,0.1)';
export const LOST = '#FF6B3D';
export const FOUND = '#30D158';
export const REVIEW = '#FFB340';
// SF Rounded for numbers on iOS; Android keeps its system font
export const ROUNDED = Platform.select({ ios: 'ui-rounded' });
// Critically damped: settles without overshoot, interruptible mid-motion
export const SPRING = { duration: 340, dampingRatio: 1 };

/** Cards: lifted a step off the black, hairline rim, continuous corners */
export const card: ViewStyle = {
  padding: 20,
  borderRadius: 28,
  borderCurve: 'continuous',
  backgroundColor: '#0E0E0E',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: RIM,
};

/** Pressable that dips on touch-down and springs back. */
const APressable = Animated.createAnimatedComponent(Pressable);
export function Press({
  style,
  scale = 0.96,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  const s = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <APressable
      accessibilityRole="button"
      {...props}
      onPressIn={(e) => {
        s.set(withSpring(scale, SPRING));
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, SPRING));
        props.onPressOut?.(e);
      }}
      style={[style, pressStyle]}
    />
  );
}
