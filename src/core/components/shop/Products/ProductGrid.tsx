import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator,
  TouchableOpacity,
  Image,
  FlatList,
  Text,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

// Define TypeScript interfaces
interface ProductVariant {
  images: string[];
  video?: string;
  fields?: {
    images?: string[];
    video?: string;
    [key: string]: any;
  };
}

interface Product {
  id?: string;
  _id?: string;
  title: string;
  price: number;
  category?: string;
  variants: ProductVariant[];
  [key: string]: any;
}

interface ApiResponse {
  products?: Product[];
  data?: Product[];
  [key: string]: any;
}

// Define navigation param list
export type RootStackParamList = {
  EditProduct: { productId: string; product: Product };
  ProductDetails: { productId: string; product: Product };
  ProductListing: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SellerProductsGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [confirmationText, setConfirmationText] = useState<string>('');
  const [showActionSheet, setShowActionSheet] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const navigation = useNavigation<NavigationProp>();

  // Calculate columns based on screen width
  const numColumns = (): number => {
    if (screenWidth >= 1024) return 4;
    if (screenWidth >= 768) return 3;
    return 3;
  };

  // Calculate grid item width
  const getGridItemWidth = (): number => {
    const columns = numColumns();
    const totalSpacing = (columns + 1) * 4;
    return (screenWidth - totalSpacing) / columns;
  };

  // Fetch user products from API
  const fetchUserProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        setError('Please login first');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `http://172.20.10.12:5000/api/seller/forms/categories/user`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          setError('Session expired. Please login again.');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return;
      }

      const data: ApiResponse = await response.json();
      
      let productsData: Product[] = [];
      if (data.products && Array.isArray(data.products)) {
        productsData = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        productsData = data.data;
      } else if (Array.isArray(data)) {
        productsData = data;
      }
      
      setProducts(productsData);
      
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull to refresh
  const handleRefresh = (): void => {
    setRefreshing(true);
    fetchUserProducts();
  };

  // Handle product long press (show options)
  const handleProductLongPress = (product: Product): void => {
    setSelectedProduct(product);
    setShowActionSheet(true);
  };

  // Handle action sheet actions
  const handleView = (): void => {
    if (selectedProduct) {
      handleProductPress(selectedProduct);
    }
    setShowActionSheet(false);
    setSelectedProduct(null);
  };

  const handleEdit = (): void => {
    if (selectedProduct) {
      handleEditProduct(selectedProduct);
    }
    setShowActionSheet(false);
    setSelectedProduct(null);
  };

  const handleDelete = (): void => {
    if (selectedProduct) {
      handleDeleteConfirmation(selectedProduct);
    }
    setShowActionSheet(false);
    setSelectedProduct(null);
  };

  const handleCancel = (): void => {
    setShowActionSheet(false);
    setSelectedProduct(null);
  };

  // Edit product - navigate to edit screen
  const handleEditProduct = (product: Product): void => {
    navigation.navigate('EditProduct', { 
      productId: product.id || product._id || '',
      product
    });
  };

  // Show delete confirmation modal
  const handleDeleteConfirmation = (product: Product): void => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  // Delete product API call
  const deleteProduct = async (): Promise<void> => {
    if (!productToDelete) return;

    const productId = productToDelete.id || productToDelete._id;
    if (!productId) {
      Alert.alert('Error', 'Invalid product ID');
      return;
    }

    // Validate confirmation text
    if (confirmationText.toLowerCase() !== 'delete') {
      Alert.alert('Error', 'Please type "delete" to confirm');
      return;
    }

    try {
      setDeleteLoading(productId);
      
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const response = await fetch(
        `http://172.20.10.12:5000/api/delete/product`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: productId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete product');
      }

      // Remove from local state
      setProducts(prev => prev.filter(p => 
        (p.id !== productId) && (p._id !== productId)
      ));

      // Close modal and reset
      setShowDeleteModal(false);
      setProductToDelete(null);
      setConfirmationText('');
      
      Alert.alert('Success', 'Product deleted successfully');

    } catch (err: any) {
      console.error('Delete product error:', err);
      Alert.alert('Error', err.message || 'Failed to delete product');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Navigate to product details
  const handleProductPress = (product: Product): void => {
    navigation.navigate('ProductDetails', { 
      productId: product.id || product._id || '',
      product
    });
  };

  // Get product image
  const FALLBACK = "https://placehold.co/500x500/000/fff?text=No+Image";

  const getProductImage = (product: any) => {
    try {
      if (product.image) {
        return product.image;
      }
      
      const v = product?.variants?.[0];
      if (v?.fields?.images?.[0]) {
        return v.fields.images[0];
      }
      
      if (v?.images?.[0]) {
        return v.images[0];
      }
    } catch (err) {
      console.log("Image Error:", err);
    }
    
    return FALLBACK;
  };

  useEffect(() => {
    fetchUserProducts();
  }, []);

  // Render custom action sheet modal
  const renderActionSheet = () => (
    <Modal
      visible={showActionSheet}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity 
        style={styles.actionSheetOverlay} 
        activeOpacity={1} 
        onPress={handleCancel}
      >
        <View style={styles.actionSheetContainer}>
          <TouchableOpacity 
            style={styles.actionSheetItem}
            onPress={handleView}
          >
            <Text style={styles.actionSheetText}>View</Text>
          </TouchableOpacity>
          
          <View style={styles.actionSheetDivider} />
          
          <TouchableOpacity 
            style={styles.actionSheetItem}
            onPress={handleEdit}
          >
            <Text style={styles.actionSheetText}>Edit</Text>
          </TouchableOpacity>
          
          <View style={styles.actionSheetDivider} />
          
          <TouchableOpacity 
            style={[styles.actionSheetItem, styles.actionSheetDelete]}
            onPress={handleDelete}
          >
            <Text style={[styles.actionSheetText, styles.actionSheetDeleteText]}>Delete</Text>
          </TouchableOpacity>
          
          <View style={styles.actionSheetDivider} />
          
          <TouchableOpacity 
            style={styles.actionSheetItem}
            onPress={handleCancel}
          >
            <Text style={styles.actionSheetText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Render each product item with long press
  const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
    const columns = numColumns();
    const gridItemWidth = getGridItemWidth();
    const isLastInRow = (index + 1) % columns === 0;
    const productId = item.id || item._id || '';

    return (
      <TouchableOpacity
        key={productId}
        activeOpacity={0.7}
        onPress={() => handleProductPress(item)}
        onLongPress={() => handleProductLongPress(item)}
        delayLongPress={500}
        style={[
          styles.productItem,
          {
            width: gridItemWidth,
            marginRight: isLastInRow ? 0 : 4,
            marginBottom: 4,
          },
        ]}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: getProductImage(item) }} 
            style={styles.productImage}
            resizeMode="cover"
            onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
          />
          
          {/* Variant Count Badge */}
          {item.variants && item.variants.length > 1 && (
            <View style={styles.variantBadge}>
              <Text style={styles.variantText}>+{item.variants.length - 1}</Text>
            </View>
          )}
          
          {/* Loading indicator for delete */}
          {deleteLoading === productId && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Delete Confirmation Modal
  const renderDeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowDeleteModal(false);
        setProductToDelete(null);
        setConfirmationText('');
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Delete Product</Text>
          
          <Text style={styles.modalText}>
            Are you sure you want to delete "{productToDelete?.title}"?
          </Text>
          
          <Text style={styles.modalWarning}>
            This action cannot be undone. All images and videos will be permanently deleted.
          </Text>
          
          <Text style={styles.confirmationLabel}>
            Type "delete" to confirm:
          </Text>
          
          <TextInput
            style={styles.confirmationInput}
            value={confirmationText}
            onChangeText={setConfirmationText}
            placeholder="Type 'delete' here"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowDeleteModal(false);
                setProductToDelete(null);
                setConfirmationText('');
              }}
              disabled={deleteLoading === (productToDelete?.id || productToDelete?._id)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton, 
                (confirmationText.toLowerCase() !== 'delete' || deleteLoading === (productToDelete?.id || productToDelete?._id)) 
                ? styles.disabledButton : null
              ]}
              onPress={deleteProduct}
              disabled={deleteLoading === (productToDelete?.id || productToDelete?._id) || confirmationText.toLowerCase() !== 'delete'}
            >
              {deleteLoading === (productToDelete?.id || productToDelete?._id) ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Render loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loadingText}>Loading your products...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>😔</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={handleRefresh}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderDeleteModal()}
      {renderActionSheet()}
      
      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item, index) => item.id || item._id || `product-${index}`}
        numColumns={numColumns()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No Products Yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first product to get started
            </Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => navigation.navigate('ProductListing')}
            >
              <Text style={styles.addButtonText}>Add Product</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  
  loaderContainer: {
    alignItems: 'center',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#4a90e2',
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  listContainer: {
    padding: 4,
    paddingBottom: 4,
  },
  
  productItem: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f3f5',
  },
  
  variantBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  variantText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#343a40',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 32,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  addButton: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    backgroundColor: '#4a90e2',
    borderRadius: 28,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  // Action Sheet Styles
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  actionSheetItem: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionSheetText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  actionSheetDelete: {
    borderTopWidth: 0,
  },
  actionSheetDeleteText: {
    color: '#FF3B30',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 8,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  modalWarning: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 20,
    fontStyle: 'italic',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  confirmationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  confirmationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
    backgroundColor: '#f9f9f9',
  },
  
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  
  disabledButton: {
    backgroundColor: '#e9ecef',
    opacity: 0.7,
  },
});