// SellerInformation.tsx - WITH GPS LOCATION AND MAP DISPLAY
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Linking,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  KeyboardAvoidingView,
  PermissionsAndroid,
} from 'react-native';
import { Config } from 'react-native-config';
import Icon from 'react-native-vector-icons/Ionicons';
import Fontisto from 'react-native-vector-icons/Fontisto';
import GetLocation from 'react-native-get-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export interface SellerLocation {
  address: string;
  latitude: number;
  longitude: number;
  googlePlaceId: string;
}

interface SellerInformationProps {
  sellerLocation: SellerLocation;
  onSellerLocationChange: (field: keyof SellerLocation, value: any) => void;
}

const { width, height } = Dimensions.get('window');

export const SellerInformation: React.FC<SellerInformationProps> = ({
  sellerLocation,
  onSellerLocationChange,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualAddressModalVisible, setManualAddressModalVisible] =
    useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showFullMapModal, setShowFullMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: sellerLocation.latitude || 28.6139,
    longitude: sellerLocation.longitude || 77.209,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const isMountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update map region when seller location changes
  useEffect(() => {
    if (sellerLocation.latitude !== 0 && sellerLocation.longitude !== 0) {
      setMapRegion({
        latitude: sellerLocation.latitude,
        longitude: sellerLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: sellerLocation.latitude,
          longitude: sellerLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  }, [sellerLocation.latitude, sellerLocation.longitude]);

  // Request location permissions for Android
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fineGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'App needs access to your location to set business address',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        if (Platform.Version >= 29) {
          const bgGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Background Location Permission',
              message: 'App needs background location for delivery tracking',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          return (
            fineGranted === PermissionsAndroid.RESULTS.GRANTED &&
            bgGranted === PermissionsAndroid.RESULTS.GRANTED
          );
        }

        return fineGranted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Permission error:', error);
        return false;
      }
    }
    return true;
  };

  // Get current location using react-native-get-location
  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setMapError(null);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable location permission to use this feature',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        setIsGettingLocation(false);
        return;
      }

      const location = await GetLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      if (location && location.latitude !== 0 && location.longitude !== 0) {
        // Update map region
        setMapRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Reverse geocode to get address from coordinates
        await reverseGeocodeAndUpdate(location.latitude, location.longitude);

      } else {
        setMapError('Invalid location received');
      }
    } catch (error: any) {
      console.error('Get location error:', error);
      if (error.message?.includes('timeout')) {
        setMapError('Location timeout. Please try again.');
      } else if (error.message?.includes('denied')) {
        setMapError('Location permission denied');
      } else {
        setMapError('Failed to get location. Please try again.');
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Reverse geocode coordinates to get address
  const reverseGeocodeAndUpdate = async (
    latitude: number,
    longitude: number,
  ) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/v0/geocode/json?latlng=${latitude},${longitude}&key=${Config.GOOGLE_SERVICES_ACCOUNT_KEY}&language=en`,
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        const placeId = data.results[0].place_id;

        onSellerLocationChange('address', address);
        onSellerLocationChange('latitude', latitude);
        onSellerLocationChange('longitude', longitude);
        onSellerLocationChange('googlePlaceId', placeId);
        setQuery(address);
        setMapError(null);
      } else {
        // Even if no address found, save coordinates
        onSellerLocationChange('latitude', latitude);
        onSellerLocationChange('longitude', longitude);
        setMapError('Address not found, but coordinates saved');
      }
    } catch (error) {
      // Still save coordinates even if reverse geocoding fails
      onSellerLocationChange('latitude', latitude);
      onSellerLocationChange('longitude', longitude);
      setMapError('Could not fetch address, but coordinates saved');
    }
  };

  // Manual address input handler
  const handleManualAddressSubmit = () => {
    if (!manualAddress.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    onSellerLocationChange('address', manualAddress);
    if (sellerLocation.latitude === 0) {
      onSellerLocationChange('latitude', 28.6139);
      onSellerLocationChange('longitude', 77.209);
    }
    setManualAddressModalVisible(false);
    setManualAddress('');
    Alert.alert('Success', 'Address saved manually!');
  };

  // Fetch address suggestions from Google Places
  const fetchSuggestions = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setMapError(null);

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/v0/place/autocomplete/json?input=${encodeURIComponent(
          text,
        )}&key=${
          Config.GOOGLE_SERVICES_ACCOUNT_KEY
        }&language=en&components=country:in`,
      );
      const data = await res.json();

      if (isMountedRef.current) {
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          setSuggestions(data.predictions || []);
        } else {
          setSuggestions([]);
        }
      }
    } catch (e) {
      if (isMountedRef.current) {
        setMapError('Failed to fetch address suggestions');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Select suggestion from Google Places
  const selectSuggestion = async (placeId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/v0/place/details/json?place_id=${placeId}&key=${Config.GOOGLE_SERVICES_ACCOUNT_KEY}&language=en`,
      );
      const data = await res.json();
      const details = data.result;

      if (details && details.geometry && details.geometry.location) {
        const lat = details.geometry.location.lat;
        const lng = details.geometry.location.lng;

        if (lat !== 0 && lng !== 0) {
          onSellerLocationChange('address', details.formatted_address || '');
          onSellerLocationChange('latitude', lat);
          onSellerLocationChange('longitude', lng);
          onSellerLocationChange('googlePlaceId', placeId);

          // Update map region
          setMapRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });

          setSuggestions([]);
          setQuery(details.formatted_address || '');
          setMapError(null);
          Alert.alert('Success', 'Location selected successfully!');
        } else {
          setMapError('Invalid coordinates received');
        }
      } else {
        setMapError('Could not fetch location details');
      }
    } catch (e) {
      setMapError('Failed to fetch location details');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setMapError(null);
  };

  const openFullMap = () => {
    setShowFullMapModal(true);
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    reverseGeocodeAndUpdate(coordinate.latitude, coordinate.longitude);
  };

  const isLocationInvalid =
    sellerLocation.latitude === 0 && sellerLocation.longitude === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="location" size={20} color="#3b82f6" />
        <Text style={styles.title}>Business Location</Text>
      </View>

      <Text style={styles.subtitle}>
        Search, use current location, or tap on map to set your business address
      </Text>

      {isLocationInvalid && (
        <View style={styles.warningContainer}>
          <Icon name="warning" size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Please select your business location
          </Text>
        </View>
      )}

      {mapError && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{mapError}</Text>
        </View>
      )}

      {/* Current Location Button */}
      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={getCurrentLocation}
        disabled={isGettingLocation}
      >
        {isGettingLocation ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Fontisto name="map-marker-alt" size={18} color="white" />
            <Text style={styles.currentLocationButtonText}>
              Use Current Location
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Manual Address Button */}
      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => setManualAddressModalVisible(true)}
      >
        <Icon name="create" size={22} color="white" />
        <Text style={styles.manualButtonText}>Enter Address Manually</Text>
      </TouchableOpacity>

      {/* Map View - Shows current location or selected location */}
      <TouchableOpacity
        style={styles.mapContainer}
        onPress={openFullMap}
        activeOpacity={0.95}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          onPress={handleMapPress}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
        >
          {(sellerLocation.latitude !== 0 || mapRegion.latitude !== 0) && (
            <Marker
              coordinate={{
                latitude:
                  sellerLocation.latitude !== 0
                    ? sellerLocation.latitude
                    : mapRegion.latitude,
                longitude:
                  sellerLocation.longitude !== 0
                    ? sellerLocation.longitude
                    : mapRegion.longitude,
              }}
              draggable
              onDragEnd={e => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                reverseGeocodeAndUpdate(latitude, longitude);
              }}
            >
              <View style={styles.markerContainer}>
                <Fontisto name="map-marker-alt" size={32} color="#ef4444" />
              </View>
            </Marker>
          )}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapTapText}>Tap to open full map</Text>
        </View>
      </TouchableOpacity>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Icon
            name="search"
            size={18}
            color="#6b7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for an address..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={fetchSuggestions}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <View style={styles.suggestionsHeader}>
              <Icon name="location-outline" size={16} color="#374151" />
              <Text style={styles.suggestionsTitle}>Select a location</Text>
            </View>
            {suggestions.map(item => (
              <TouchableOpacity
                key={item.place_id}
                onPress={() => selectSuggestion(item.place_id)}
                style={styles.suggestionItem}
              >
                <Icon name="business" size={16} color="#6b7280" />
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Selected Address Display */}
      {sellerLocation.address ? (
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Icon name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.addressTitle}>Selected Address</Text>
          </View>
          <Text style={styles.addressText}>{sellerLocation.address}</Text>
        </View>
      ) : null}

      {sellerLocation.latitude !== 0 && sellerLocation.longitude !== 0 && (
        <View style={styles.coordinatesCard}>
          <View style={styles.coordinatesHeader}>
            <Icon name="map" size={16} color="#6b7280" />
            <Text style={styles.coordinatesTitle}>Coordinates</Text>
          </View>
          <Text style={styles.coordinatesText}>
            Lat: {sellerLocation.latitude.toFixed(6)}, Lng:{' '}
            {sellerLocation.longitude.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Full Map Modal */}
      <Modal
        animationType="slide"
        visible={showFullMapModal}
        onRequestClose={() => setShowFullMapModal(false)}
      >
        <SafeAreaView style={styles.fullMapContainer}>
          <View style={styles.fullMapHeader}>
            <TouchableOpacity
              onPress={() => setShowFullMapModal(false)}
              style={styles.fullMapBackButton}
            >
              <Icon name="arrow-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>Select Location on Map</Text>
            {sellerLocation.latitude !== 0 && (
              <TouchableOpacity
                onPress={() => setShowFullMapModal(false)}
                style={styles.fullMapDoneButton}
              >
                <Text style={styles.fullMapDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
          <MapView
            style={styles.fullMap}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {(sellerLocation.latitude !== 0 || mapRegion.latitude !== 0) && (
              <Marker
                coordinate={{
                  latitude:
                    sellerLocation.latitude !== 0
                      ? sellerLocation.latitude
                      : mapRegion.latitude,
                  longitude:
                    sellerLocation.longitude !== 0
                      ? sellerLocation.longitude
                      : mapRegion.longitude,
                }}
                draggable
                onDragEnd={e => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  reverseGeocodeAndUpdate(latitude, longitude);
                }}
              >
                <View style={styles.markerContainer}>
                  <Fontisto name="map-marker-alt" size={40} color="#ef4444" />
                </View>
              </Marker>
            )}
          </MapView>
          <View style={styles.fullMapFooter}>
            <Text style={styles.fullMapFooterText}>
              Tap anywhere on map or drag the marker to set location
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Manual Address Input Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={manualAddressModalVisible}
        onRequestClose={() => setManualAddressModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.manualModalOverlay}
        >
          <View style={styles.manualModalContent}>
            <View style={styles.manualModalHeader}>
              <Text style={styles.manualModalTitle}>
                Enter Address Manually
              </Text>
              <TouchableOpacity
                onPress={() => setManualAddressModalVisible(false)}
              >
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.manualInput}
              placeholder="Type your full address here..."
              placeholderTextColor="#9ca3af"
              value={manualAddress}
              onChangeText={setManualAddress}
              multiline
              numberOfLines={3}
            />

            <View style={styles.manualModalButtons}>
              <TouchableOpacity
                style={[styles.manualModalButton, styles.manualCancelButton]}
                onPress={() => setManualAddressModalVisible(false)}
              >
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualModalButton, styles.manualSaveButton]}
                onPress={handleManualAddressSubmit}
              >
                <Text style={styles.manualSaveText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginLeft: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: { fontSize: 14, color: '#92400e', marginLeft: 8, flex: 1 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: { fontSize: 14, color: '#991b1b', marginLeft: 8, flex: 1 },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  currentLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  manualButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapTapText: { fontSize: 12, color: 'white' },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  searchContainer: { marginBottom: 16 },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1f2937', paddingVertical: 12 },
  clearButton: { padding: 4 },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  loadingText: { fontSize: 12, color: '#6b7280', marginLeft: 6 },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionText: { fontSize: 14, color: '#374151', marginLeft: 8, flex: 1 },
  addressCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 8,
  },
  addressText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  coordinatesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  coordinatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  coordinatesTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  coordinatesText: { fontSize: 12, color: '#374151', marginLeft: 22 },

  // Full Map Modal Styles
  fullMapContainer: { flex: 1, backgroundColor: '#fff' },
  fullMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  fullMapBackButton: { padding: 8 },
  fullMapTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  fullMapDoneButton: { padding: 8 },
  fullMapDoneText: { fontSize: 16, fontWeight: '600', color: '#3b82f6' },
  fullMap: { flex: 1 },
  fullMapFooter: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  fullMapFooterText: { fontSize: 14, color: '#64748b', textAlign: 'center' },

  // Manual Modal Styles
  manualModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    padding: 20,
  },
  manualModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  manualInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#1f2937',
  },
  manualModalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  manualModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualCancelButton: { backgroundColor: '#f3f4f6' },
  manualCancelText: { fontSize: 16, color: '#6b7280', fontWeight: '500' },
  manualSaveButton: { backgroundColor: '#10b981' },
  manualSaveText: { fontSize: 16, color: 'white', fontWeight: '600' },
});

export default SellerInformation;
