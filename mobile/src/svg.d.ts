// phosphor-react-native's source passes className to <Svg>; react-native-svg's types don't declare it
import 'react-native-svg';
declare module 'react-native-svg' {
  interface SvgProps {
    className?: string;
  }
}
