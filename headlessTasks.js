// headlessTasks.js
import { AppRegistry } from 'react-native';
// Import the function you defined earlier
import { locationTask } from './src/core/utils/cab/driverAvailability';

// This registration is the critical missing piece.
// The string 'DriverLocationTracking' MUST match the `taskName` in your `BackgroundActions.start()` options.
AppRegistry.registerHeadlessTask('DriverLocationTracking', () => locationTask);
