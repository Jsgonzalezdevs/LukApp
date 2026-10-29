import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './src/App';

function LukAppMovil() {
  return <SafeAreaProvider><App /></SafeAreaProvider>;
}

registerRootComponent(LukAppMovil);
