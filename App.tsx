/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import TizzyOS from './src/navigations';
import { ThemeProvider } from './src/core/contexts/theme/ThemeContext';
import { ZeptPayProvider } from '@flixora/zeptpay-react-native';

function App() {
  return (
    <ThemeProvider>
      <ZeptPayProvider publicKey="pk-flixora_test_@zeptpay:tizzy-flixora-ecosystem_053bf0f4f1e59760a3f63fe3ebc28a1920f4b57c93c8e648">
        <TizzyOS />
      </ZeptPayProvider>
    </ThemeProvider>
  );
}
export default App;
