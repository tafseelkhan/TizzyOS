// File: ProductForm.tsx - FINAL VERSION (UploadProgressModal alag file mein)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Switch,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';

// ==================== IMPORT SEPARATE COMPONENTS ====================
import { SellerInformation, SellerLocation } from '../SellerInformation';
import UploadProgressModal from './upload/uploadProgressModal'; // ✅ ALAG FILE SE IMPORT

// ==================== TYPES ====================
interface Subcategory {
  name: string;
  specs: string[];
  variantOptions: string[];
}

interface Category {
  _id: string;
  category: string;
  subcategories: Subcategory[];
}

interface Variant {
  fields: Record<string, string>;
  sku: string;
  mrp: number;
  price: number;
  savedAmount: number;
  discount: number;
  offerText: string;
  finalPrice: number;
  weight: string;
  weightUnit: 'GRAM' | 'KG';
  height: string;
  width: string;
  length: string;
  dimensionUnit: 'CM' | 'INCH';
  inStock: boolean;
  quantityAvailable: number;
  images: string[];
  video: string | null;
  isDefault: boolean;
  gstRate: number;
  gstType: 'INCLUSIVE' | 'EXCLUSIVE';
  gstSource: 'auto' | 'manual';
  gstAmount?: number;
}

interface FrontendVariant extends Variant {
  localImages: string[];
  localVideo: string | null;
  videoThumbnail?: string | null;
}

interface ProductFormData {
  title: string;
  brand: string;
  description: string;
  category: string;
  subcategory: string;
  variants: FrontendVariant[];
  deliveryTime: string;
  warranty: string;
  returnPolicy: string;
  shortDescription: string;
  fullDescription: string;
  highlights: string[];
  sellerLocation: SellerLocation;
  specs: Record<string, string>;
  variantOptions: string[];
  variantValues: Record<string, string[]>;
  protectPromiseFees: boolean;
  freeDelivery: boolean;
  fastDelivery: boolean;
  safety: boolean;
  productQuality: boolean;
  paymentOptions: boolean;
  manufacturer: boolean;
  cashOnDelivery: boolean;
  deliveryVehicleType: boolean;
  verified: boolean;
  fulfillmentType: 'SELLER' | 'FWS';
}

// ==================== PRICE PREVIEW COMPONENT ====================
interface PricePreviewProps {
  mrp: number;
  price: number;
  gstType: 'INCLUSIVE' | 'EXCLUSIVE';
  category: string;
  subcategory: string;
  onPricingCalculated?: (data: any) => void;
}

const PricePreview: React.FC<PricePreviewProps> = ({
  mrp,
  price,
  gstType,
  category,
  subcategory,
  onPricingCalculated,
}) => {
  const [loading, setLoading] = useState(false);
  const [pricingData, setPricingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mrp > 0 && price > 0 && category && subcategory) {
      calculatePricing();
    } else {
      setPricingData(null);
    }
  }, [mrp, price, gstType, category, subcategory]);

  const calculatePricing = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'http://172.20.10.12:5000/api/seller/product/price-calculation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mrp: mrp,
            price: price,
            category: category,
            subcategory: subcategory,
            gstType: gstType,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setPricingData(result.data);
        if (onPricingCalculated) {
          onPricingCalculated({
            savedAmount: result.data.savedAmount,
            discount: result.data.discountPercentage,
            finalPrice: result.data.finalPrice,
            gstRate: result.data.gstRate,
            gstAmount: result.data.gstAmount,
            checkoutTotal: result.data.checkoutTotal,
            basePrice: result.data.basePrice,
            customerPays: result.data.customerPays,
          });
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to calculate pricing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (price === 0 || mrp === 0 || !category || !subcategory) {
    return (
      <View style={localStyles.pricePreviewContainer}>
        <Text style={localStyles.pricePreviewTitle}>Price Preview</Text>
        <Text style={localStyles.pricePreviewPlaceholder}>
          Enter MRP, Price, Category & Subcategory to see preview
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={localStyles.pricePreviewContainer}>
        <Text style={localStyles.pricePreviewTitle}>Calculating...</Text>
        <ActivityIndicator
          size="small"
          color="#3b82f6"
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }

  if (error || !pricingData) {
    return (
      <View style={localStyles.pricePreviewContainer}>
        <Text style={localStyles.pricePreviewTitle}>Price Preview</Text>
        <Text style={localStyles.pricePreviewPlaceholder}>
          {error || 'Unable to calculate pricing'}
        </Text>
      </View>
    );
  }

  if (gstType === 'INCLUSIVE') {
    return (
      <View style={localStyles.pricePreviewContainer}>
        <Text style={localStyles.pricePreviewTitle}>
          Price Preview (Inclusive GST)
        </Text>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>MRP:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{mrp.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Price (incl. GST):</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{pricingData.finalPrice.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Base Price:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{(pricingData.basePrice || 0).toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Saved Amount:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{pricingData.savedAmount.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Discount:</Text>
          <Text style={localStyles.pricePreviewValue}>
            {pricingData.discountPercentage}%
          </Text>
        </View>
        <View style={[localStyles.pricePreviewRow, localStyles.gstInfoRow]}>
          <Text style={localStyles.pricePreviewLabel}>
            GST ({pricingData.gstRate}%):
          </Text>
          <Text style={localStyles.pricePreviewGstInfo}>
            ₹{pricingData.gstAmount} will be added at checkout
          </Text>
        </View>
        <View
          style={[localStyles.pricePreviewRow, localStyles.pricePreviewTotal]}
        >
          <Text style={localStyles.pricePreviewTotalLabel}>
            Checkout Total (incl. GST):
          </Text>
          <Text style={localStyles.pricePreviewTotalValue}>
            ₹
            {(
              pricingData.customerPays || pricingData.finalPrice
            ).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
    );
  } else {
    return (
      <View style={localStyles.pricePreviewContainer}>
        <Text style={localStyles.pricePreviewTitle}>
          Price Preview (Exclusive GST)
        </Text>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>MRP:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{mrp.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Base Price:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{pricingData.finalPrice.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Saved Amount:</Text>
          <Text style={localStyles.pricePreviewValue}>
            ₹{pricingData.savedAmount.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={localStyles.pricePreviewRow}>
          <Text style={localStyles.pricePreviewLabel}>Discount:</Text>
          <Text style={localStyles.pricePreviewValue}>
            {pricingData.discountPercentage}%
          </Text>
        </View>
        <View
          style={[localStyles.pricePreviewRow, localStyles.pricePreviewTotal]}
        >
          <Text style={localStyles.pricePreviewTotalLabel}>
            Customer Price (Excl. GST):
          </Text>
          <Text style={localStyles.pricePreviewTotalValue}>
            ₹
            {(
              pricingData.checkoutTotal || pricingData.finalPrice
            ).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
    );
  }
};

// ==================== TOGGLE ROW COMPONENT ====================
interface ToggleRowProps {
  label: string;
  icon: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  icon,
  value,
  onValueChange,
  description,
}) => {
  const TOGGLE_COLOR = '#3b82f6';

  return (
    <View style={localStyles.toggleRowContainer}>
      <View style={localStyles.toggleRowLeft}>
        <View
          style={[
            localStyles.toggleRowIcon,
            { backgroundColor: TOGGLE_COLOR + '15' },
          ]}
        >
          <Icon name={icon} size={20} color={TOGGLE_COLOR} />
        </View>
        <View>
          <Text style={localStyles.toggleRowLabel}>{label}</Text>
          {description && (
            <Text style={localStyles.toggleRowDesc}>{description}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e2e8f0', true: TOGGLE_COLOR }}
        thumbColor={Platform.OS === 'ios' ? '#fff' : '#fff'}
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
};

// ==================== GST TOGGLE COMPONENT ====================
interface GSTToggleProps {
  gstType: 'INCLUSIVE' | 'EXCLUSIVE';
  onGSTTypeChange: (type: 'INCLUSIVE' | 'EXCLUSIVE') => void;
}

const GSTToggle: React.FC<GSTToggleProps> = ({ gstType, onGSTTypeChange }) => {
  return (
    <View style={localStyles.gstContainer}>
      <Text style={localStyles.gstLabel}>GST Type for this Variant</Text>
      <View style={localStyles.gstToggleWrapper}>
        <TouchableOpacity
          style={[
            localStyles.gstOption,
            gstType === 'EXCLUSIVE' && localStyles.gstOptionActive,
          ]}
          onPress={() => onGSTTypeChange('EXCLUSIVE')}
        >
          <View style={localStyles.gstRadio}>
            {gstType === 'EXCLUSIVE' && (
              <View style={localStyles.gstRadioSelected} />
            )}
          </View>
          <View style={localStyles.gstContent}>
            <Text
              style={[
                localStyles.gstTitle,
                gstType === 'EXCLUSIVE' && localStyles.gstTitleActive,
              ]}
            >
              Exclusive GST
            </Text>
            <Text style={localStyles.gstDesc}>
              Price + GST will be added at checkout
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            localStyles.gstOption,
            gstType === 'INCLUSIVE' && localStyles.gstOptionActive,
          ]}
          onPress={() => onGSTTypeChange('INCLUSIVE')}
        >
          <View style={localStyles.gstRadio}>
            {gstType === 'INCLUSIVE' && (
              <View style={localStyles.gstRadioSelected} />
            )}
          </View>
          <View style={localStyles.gstContent}>
            <Text
              style={[
                localStyles.gstTitle,
                gstType === 'INCLUSIVE' && localStyles.gstTitleActive,
              ]}
            >
              Inclusive GST
            </Text>
            <Text style={localStyles.gstDesc}>Price already includes GST</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==================== WEIGHT UNIT TOGGLE ====================
interface WeightUnitToggleProps {
  weightUnit: 'GRAM' | 'KG';
  onWeightUnitChange: (unit: 'GRAM' | 'KG') => void;
}

const WeightUnitToggle: React.FC<WeightUnitToggleProps> = ({
  weightUnit,
  onWeightUnitChange,
}) => {
  return (
    <View style={localStyles.unitToggleContainer}>
      <Text style={localStyles.unitToggleLabel}>Weight Unit</Text>
      <View style={localStyles.unitToggleWrapper}>
        <TouchableOpacity
          style={[
            localStyles.unitOption,
            weightUnit === 'GRAM' && localStyles.unitOptionActive,
          ]}
          onPress={() => onWeightUnitChange('GRAM')}
        >
          <Text
            style={[
              localStyles.unitOptionText,
              weightUnit === 'GRAM' && localStyles.unitOptionTextActive,
            ]}
          >
            GRAM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            localStyles.unitOption,
            weightUnit === 'KG' && localStyles.unitOptionActive,
          ]}
          onPress={() => onWeightUnitChange('KG')}
        >
          <Text
            style={[
              localStyles.unitOptionText,
              weightUnit === 'KG' && localStyles.unitOptionTextActive,
            ]}
          >
            KG
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==================== DIMENSION UNIT TOGGLE ====================
interface DimensionUnitToggleProps {
  dimensionUnit: 'CM' | 'INCH';
  onDimensionUnitChange: (unit: 'CM' | 'INCH') => void;
}

const DimensionUnitToggle: React.FC<DimensionUnitToggleProps> = ({
  dimensionUnit,
  onDimensionUnitChange,
}) => {
  return (
    <View style={localStyles.unitToggleContainer}>
      <Text style={localStyles.unitToggleLabel}>Dimension Unit</Text>
      <View style={localStyles.unitToggleWrapper}>
        <TouchableOpacity
          style={[
            localStyles.unitOption,
            dimensionUnit === 'CM' && localStyles.unitOptionActive,
          ]}
          onPress={() => onDimensionUnitChange('CM')}
        >
          <Text
            style={[
              localStyles.unitOptionText,
              dimensionUnit === 'CM' && localStyles.unitOptionTextActive,
            ]}
          >
            CM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            localStyles.unitOption,
            dimensionUnit === 'INCH' && localStyles.unitOptionActive,
          ]}
          onPress={() => onDimensionUnitChange('INCH')}
        >
          <Text
            style={[
              localStyles.unitOptionText,
              dimensionUnit === 'INCH' && localStyles.unitOptionTextActive,
            ]}
          >
            INCH
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==================== FORMAT PRICE HELPER ====================
const formatPrice = (price: number): string => {
  if (isNaN(price) || price === 0) return '';
  return price.toLocaleString('en-IN');
};

// ==================== HELPERS ====================
const pickMultipleImages = async (): Promise<{ uri: string }[]> => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 10, quality: 0.8 },
      response => {
        if (response.didCancel) resolve([]);
        else if (response.errorCode)
          reject(new Error(response.errorMessage || 'Unknown error'));
        else if (response.assets)
          resolve(response.assets.map(asset => ({ uri: asset.uri || '' })));
        else resolve([]);
      },
    );
  });
};

const pickVideo = async (): Promise<{ uri: string } | null> => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      { mediaType: 'video', selectionLimit: 1, quality: 0.8 },
      response => {
        if (response.didCancel) resolve(null);
        else if (response.errorCode)
          reject(new Error(response.errorMessage || 'Unknown error'));
        else if (response.assets && response.assets[0])
          resolve({ uri: response.assets[0].uri || '' });
        else resolve(null);
      },
    );
  });
};

const generateVideoThumbnail = async (
  videoUri: string,
): Promise<string | null> => {
  return null;
};

// ==================== VIDEO PREVIEW COMPONENT ====================
interface VideoPreviewProps {
  videoUri: string | null;
  onRemove: () => void;
  isUploaded?: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUri,
  onRemove,
  isUploaded = false,
}) => {
  const [playing, setPlaying] = useState(false);

  if (!videoUri) return null;

  return (
    <View style={localStyles.videoPreviewContainer}>
      <View style={localStyles.videoPreviewWrapper}>
        {!playing ? (
          <TouchableOpacity
            style={localStyles.videoThumbnailWrapper}
            onPress={() => setPlaying(true)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: videoUri }}
              style={localStyles.videoThumbnail}
              resizeMode="cover"
            />
            <View style={localStyles.playButtonOverlay}>
              <View style={localStyles.playButtonCircle}>
                <Icon name="play-arrow" size={32} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={localStyles.videoPlayerWrapper}>
            <Video
              source={{ uri: videoUri }}
              style={localStyles.videoPlayer}
              controls={true}
              paused={false}
              resizeMode="contain"
              onEnd={() => setPlaying(false)}
            />
            <TouchableOpacity
              style={localStyles.closeVideoButton}
              onPress={() => setPlaying(false)}
            >
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={localStyles.videoRemoveButton}
          onPress={onRemove}
        >
          <Icon name="delete-outline" size={18} color="#ef4444" />
          <Text style={localStyles.videoRemoveText}>Remove</Text>
        </TouchableOpacity>
        {isUploaded && (
          <View style={localStyles.videoUploadedBadge}>
            <Icon name="check-circle" size={14} color="#10b981" />
            <Text style={localStyles.videoUploadedText}>Uploaded</Text>
          </View>
        )}
        {!isUploaded && !playing && (
          <View style={localStyles.videoPendingBadge}>
            <Text style={localStyles.videoPendingText}>Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ==================== MAIN COMPONENT ====================
export const ProductForm: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();

  // ==================== STATE ====================
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    brand: '',
    description: '',
    category: '',
    subcategory: '',
    variants: [],
    deliveryTime: '',
    warranty: '',
    returnPolicy: '',
    shortDescription: '',
    fullDescription: '',
    highlights: [],
    sellerLocation: {
      address: '',
      latitude: 0,
      longitude: 0,
      googlePlaceId: '',
    },
    specs: {},
    variantOptions: [],
    variantValues: {},
    protectPromiseFees: false,
    freeDelivery: false,
    fastDelivery: false,
    safety: false,
    productQuality: false,
    paymentOptions: false,
    manufacturer: false,
    cashOnDelivery: false,
    deliveryVehicleType: false,
    verified: false,
    fulfillmentType: 'SELLER',
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(null);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    uploaded: 0,
    percent: 0,
  });
  const [isTakingLong, setIsTakingLong] = useState(false);
  const uploadStartTime = useRef<number>(0);
  const longUploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentVariant, setCurrentVariant] = useState<FrontendVariant>({
    fields: {},
    sku: '',
    mrp: 0,
    price: 0,
    savedAmount: 0,
    discount: 0,
    offerText: '',
    finalPrice: 0,
    weight: '',
    weightUnit: 'GRAM',
    height: '',
    width: '',
    length: '',
    dimensionUnit: 'CM',
    inStock: true,
    quantityAvailable: 0,
    images: [],
    video: null,
    isDefault: false,
    localImages: [],
    localVideo: null,
    videoThumbnail: null,
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    gstSource: 'auto',
    gstAmount: undefined,
  });

  const updateVariantField = (
    field: keyof Omit<
      FrontendVariant,
      'localImages' | 'localVideo' | 'videoThumbnail'
    >,
    value: any,
  ) => {
    setCurrentVariant(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePricingCalculated = (calculatedData: any) => {
    setCurrentVariant(prev => ({
      ...prev,
      savedAmount: calculatedData.savedAmount,
      discount: calculatedData.discount,
      finalPrice: calculatedData.finalPrice,
      gstRate: calculatedData.gstRate,
      gstAmount: calculatedData.gstAmount,
    }));
  };

  // ==================== SELLER LOCATION HANDLER ====================
  const handleSellerLocationChange = (
    field: keyof SellerLocation,
    value: any,
  ) => {
    setFormData(prev => ({
      ...prev,
      sellerLocation: {
        ...prev.sellerLocation,
        [field]: value,
      },
    }));
  };

  // ==================== API CALLS ====================
  const fetchCategories = async () => {
    try {
      const response = await fetch('http://172.20.10.12:5000/api/categories');
      const data = await response.json();
      let categoriesData: Category[] = [];
      if (Array.isArray(data)) categoriesData = data;
      else if (data.categories && Array.isArray(data.categories))
        categoriesData = data.categories;
      else if (data.data && Array.isArray(data.data))
        categoriesData = data.data;
      setCategories(categoriesData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load categories');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (longUploadTimer.current) {
        clearTimeout(longUploadTimer.current);
      }
    };
  }, []);

  // ==================== HANDLERS ====================
  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setCategoryModalVisible(false);
    setFormData(prev => ({
      ...prev,
      category: category.category,
      subcategory: '',
      specs: {},
      variantOptions: [],
      variantValues: {},
    }));
  };

  const handleSubcategorySelect = (subcategory: Subcategory) => {
    if (!selectedCategory) return;
    setSelectedSubcategory(subcategory);
    setSubcategoryModalVisible(false);
    setFormData(prev => ({
      ...prev,
      subcategory: subcategory.name,
      specs: {},
      variantOptions: subcategory.variantOptions || [],
      variantValues: {},
    }));
  };

  // ==================== VARIANT FUNCTIONS ====================
  const addVariant = () => {
    if (!selectedSubcategory) {
      Alert.alert('Error', 'Please select category and subcategory first');
      return;
    }
    const opts = selectedSubcategory.variantOptions || [];
    const fields: Record<string, string> = {};
    opts.forEach(opt => {
      fields[opt] = '';
    });
    setCurrentVariant({
      fields,
      sku: '',
      mrp: 0,
      price: 0,
      savedAmount: 0,
      discount: 0,
      offerText: '',
      finalPrice: 0,
      weight: '',
      weightUnit: 'GRAM',
      height: '',
      width: '',
      length: '',
      dimensionUnit: 'CM',
      inStock: true,
      quantityAvailable: 0,
      images: [],
      video: null,
      isDefault: formData.variants.length === 0,
      localImages: [],
      localVideo: null,
      videoThumbnail: null,
      gstRate: 18,
      gstType: 'EXCLUSIVE',
      gstSource: 'auto',
      gstAmount: undefined,
    });
    setEditingVariantIndex(null);
    setVariantModalVisible(true);
  };

  const handleVariantImageSelect = async () => {
    const imgs = await pickMultipleImages();
    if (imgs.length) {
      setCurrentVariant(prev => ({
        ...prev,
        localImages: [...prev.localImages, ...imgs.map(i => i.uri)],
      }));
    }
  };

  const handleVariantVideoSelect = async () => {
    const video = await pickVideo();
    if (video) {
      const thumbnail = await generateVideoThumbnail(video.uri);
      setCurrentVariant(prev => ({
        ...prev,
        localVideo: video.uri,
        videoThumbnail: thumbnail,
      }));
    }
  };

  const removeVariantImage = (index: number) => {
    setCurrentVariant(prev => ({
      ...prev,
      localImages: prev.localImages.filter((_, i) => i !== index),
    }));
  };

  const removeVariantVideo = () => {
    setCurrentVariant(prev => ({
      ...prev,
      localVideo: null,
      videoThumbnail: null,
    }));
  };

  // ✅ FIXED saveVariant function - Deep copy with all values including GST
  const saveVariant = () => {
    const variantOptions = selectedSubcategory?.variantOptions || [];
    const missing = variantOptions.filter(
      opt => !currentVariant.fields[opt]?.trim(),
    );

    if (missing.length) {
      Alert.alert('Error', `Please fill: ${missing.join(', ')}`);
      return;
    }

    if (
      currentVariant.localImages.length === 0 &&
      currentVariant.images.length === 0
    ) {
      Alert.alert('Error', 'Please add at least one image for this variant');
      return;
    }

    if (currentVariant.mrp <= 0) {
      Alert.alert('Error', 'MRP is required');
      return;
    }
    if (currentVariant.price <= 0) {
      Alert.alert('Error', 'Base Price is required');
      return;
    }
    if (currentVariant.price > currentVariant.mrp) {
      Alert.alert('Error', 'Base Price cannot be greater than MRP');
      return;
    }

    if (!currentVariant.weight || parseFloat(currentVariant.weight) <= 0) {
      Alert.alert('Error', 'Weight is required and must be greater than 0');
      return;
    }

    if (
      !currentVariant.height ||
      !currentVariant.width ||
      !currentVariant.length
    ) {
      Alert.alert('Error', 'Height, Width, and Length are required');
      return;
    }

    const newVariantValues = { ...formData.variantValues };
    variantOptions.forEach(opt => {
      const val = currentVariant.fields[opt];
      if (val && !newVariantValues[opt]?.includes(val)) {
        newVariantValues[opt] = [...(newVariantValues[opt] || []), val];
      }
    });

    // ✅ CRITICAL FIX: Create a DEEP COPY of the variant with ALL values
    const variantToSave: FrontendVariant = {
      fields: { ...currentVariant.fields },
      sku: currentVariant.sku,
      mrp: currentVariant.mrp,
      price: currentVariant.price,
      savedAmount: currentVariant.savedAmount,
      discount: currentVariant.discount,
      offerText: currentVariant.offerText,
      finalPrice: currentVariant.finalPrice,
      weight: currentVariant.weight,
      weightUnit: currentVariant.weightUnit,
      height: currentVariant.height,
      width: currentVariant.width,
      length: currentVariant.length,
      dimensionUnit: currentVariant.dimensionUnit,
      inStock: currentVariant.inStock,
      quantityAvailable: currentVariant.quantityAvailable,
      images: [...currentVariant.images],
      video: currentVariant.video,
      isDefault: currentVariant.isDefault,
      localImages: [...currentVariant.localImages],
      localVideo: currentVariant.localVideo,
      videoThumbnail: currentVariant.videoThumbnail,
      gstRate: currentVariant.gstRate,
      gstType: currentVariant.gstType,
      gstSource: currentVariant.gstSource,
      gstAmount: currentVariant.gstAmount,
    };

    console.log('💾 Saving variant with GST Type:', variantToSave.gstType);

    if (editingVariantIndex !== null) {
      const variants = [...formData.variants];
      variants[editingVariantIndex] = variantToSave;
      setFormData(prev => ({
        ...prev,
        variants,
        variantValues: newVariantValues,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        variants: [...prev.variants, variantToSave],
        variantValues: newVariantValues,
      }));
    }

    setVariantModalVisible(false);
  };

  const editVariant = (index: number) => {
    const variant = formData.variants[index];
    setCurrentVariant({
      ...variant,
      localImages: [],
      localVideo: null,
      videoThumbnail: null,
    });
    setEditingVariantIndex(index);
    setVariantModalVisible(true);
  };

  const removeVariant = (index: number) => {
    Alert.alert('Remove Variant', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index),
          })),
      },
    ]);
  };

  const uploadFileDirect = async (
    file: any,
    uploadUrl: string,
    onProgress?: (percent: number) => void,
  ) => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = event => {
          if (event.lengthComputable && onProgress) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(percent);
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve(true);
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
        xhr.send(blob);
      } catch (error) {
        reject(error);
      }
    });
  };

  const uploadAllFiles = async () => {
    try {
      setUploading(true);
      setIsTakingLong(false);
      uploadStartTime.current = Date.now();
      longUploadTimer.current = setTimeout(() => {
        setIsTakingLong(true);
      }, 5000);

      const uploads: {
        type: 'image' | 'video';
        uri: string;
        variantIndex: number;
      }[] = [];

      formData.variants.forEach((variant, idx) => {
        variant.localImages.forEach(uri => {
          uploads.push({ type: 'image', uri, variantIndex: idx });
        });
        if (variant.localVideo) {
          uploads.push({
            type: 'video',
            uri: variant.localVideo,
            variantIndex: idx,
          });
        }
      });

      if (uploads.length === 0) return true;
      setUploadProgress({ total: uploads.length, uploaded: 0, percent: 0 });

      for (let i = 0; i < uploads.length; i++) {
        const item = uploads[i];
        const ext = item.type === 'image' ? 'jpg' : 'mp4';
        const fileName = `products/${item.type}_${Date.now()}_${i}.${ext}`;

        const res = await fetch(
          'http://172.20.10.12:5000/api/upload/get-upload-url',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              fileType: item.type === 'image' ? 'image/jpeg' : 'video/mp4',
            }),
          },
        );
        const { uploadUrl, filePath } = await res.json();

        await uploadFileDirect(
          {
            uri: item.uri,
            type: item.type === 'image' ? 'image/jpeg' : 'video/mp4',
          },
          uploadUrl,
          percent => {
            console.log(`Uploading ${fileName}: ${percent.toFixed(0)}%`);
          },
        );

        setFormData(prev => {
          const variants = [...prev.variants];
          if (item.type === 'image') {
            variants[item.variantIndex].images.push(filePath);
            variants[item.variantIndex].localImages = variants[
              item.variantIndex
            ].localImages.filter(img => img !== item.uri);
          } else {
            variants[item.variantIndex].video = filePath;
            variants[item.variantIndex].localVideo = null;
          }
          return { ...prev, variants };
        });

        setUploadProgress(p => ({
          ...p,
          uploaded: p.uploaded + 1,
          percent: Math.round(((p.uploaded + 1) / p.total) * 100),
        }));
      }

      if (longUploadTimer.current) clearTimeout(longUploadTimer.current);
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload Error', 'Failed to upload files. Please try again.');
      return false;
    } finally {
      setUploading(false);
      if (longUploadTimer.current) clearTimeout(longUploadTimer.current);
    }
  };

  // ==================== SUBMIT ====================
  const handleSubmit = async () => {
    if (!formData.title || !formData.category || !formData.subcategory) {
      return Alert.alert('Error', 'Title, category & subcategory are required');
    }
    if (formData.variants.length === 0) {
      return Alert.alert('Error', 'At least one variant is required');
    }
    const hasImages = formData.variants.some(
      v => v.localImages.length > 0 || v.images.length > 0,
    );
    if (!hasImages) {
      return Alert.alert(
        'Error',
        'Please add at least one image for each variant',
      );
    }

    if (!formData.sellerLocation.address) {
      return Alert.alert(
        'Error',
        'Please select or enter your business location',
      );
    }

    setLoading(true);
    const uploaded = await uploadAllFiles();
    if (!uploaded) {
      setLoading(false);
      return;
    }

    const payload = {
      title: formData.title,
      brand: formData.brand,
      description: formData.description,
      category: formData.category,
      subcategory: formData.subcategory,
      variantOptions: formData.variantOptions,
      variantValues: formData.variantValues,
      variants: formData.variants.map(v => ({
        fields: v.fields,
        sku: v.sku,
        mrp: v.mrp,
        price: v.price,
        savedAmount: v.savedAmount,
        discount: v.discount,
        finalPrice: v.finalPrice,
        offerText: v.offerText,
        weight: parseFloat(v.weight) || 0,
        weightUnit: v.weightUnit,
        height: parseFloat(v.height) || 0,
        width: parseFloat(v.width) || 0,
        length: parseFloat(v.length) || 0,
        dimensionUnit: v.dimensionUnit,
        inStock: v.inStock,
        quantityAvailable: v.quantityAvailable,
        images: v.images,
        video: v.video,
        isDefault: v.isDefault,
        gstRate: v.gstRate,
        gstType: v.gstType,
        gstSource: v.gstSource,
        gstAmount: v.gstAmount,
      })),
      deliveryTime: formData.deliveryTime,
      warranty: formData.warranty,
      returnPolicy: formData.returnPolicy,
      shortDescription: formData.shortDescription,
      fullDescription: formData.fullDescription,
      highlights: formData.highlights.filter(h => h && h.trim().length > 0),
      sellerLocation: {
        address: formData.sellerLocation.address,
        latitude: formData.sellerLocation.latitude,
        longitude: formData.sellerLocation.longitude,
        googlePlaceId: formData.sellerLocation.googlePlaceId,
      },
      specs: formData.specs || {},
      protectPromiseFees: formData.protectPromiseFees,
      freeDelivery: formData.freeDelivery,
      fastDelivery: formData.fastDelivery,
      safety: formData.safety,
      productQuality: formData.productQuality,
      paymentOptions: formData.paymentOptions,
      manufacturer: formData.manufacturer,
      cashOnDelivery: formData.cashOnDelivery,
      deliveryVehicleType: formData.deliveryVehicleType,
      verified: false,
      fulfillmentType: formData.fulfillmentType,
    };

    console.log('📦 Final payload variants:');
    payload.variants.forEach((v, idx) => {
      console.log(`  Variant ${idx + 1}: GST Type = ${v.gstType}`);
    });

    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(
      'http://172.20.10.12:5000/api/seller/forms/categories/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (response.ok) {
      Alert.alert('Success', 'Product created successfully!');
      navigation.goBack();
    } else {
      throw new Error(result.message || 'Failed to create product');
    }
    setLoading(false);
  };

  // ==================== RENDER ====================
  return (
    <SafeAreaView style={localStyles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={localStyles.content}
        >
          {/* Header */}
          <View style={localStyles.header}>
            <View style={localStyles.headerBadge}>
              <Icon name="inventory-2" size={28} color="#fff" />
            </View>
            <Text style={localStyles.headerTitle}>Add New Product</Text>
            <Text style={localStyles.headerSubtitle}>
              Create a new product listing
            </Text>
          </View>

          {/* SECTION 1: CATEGORY & SUBCATEGORY */}
          <View style={localStyles.sectionCard}>
            <View style={localStyles.sectionHeader}>
              <View style={localStyles.sectionIconBg}>
                <Icon name="category" size={20} color="#6366f1" />
              </View>
              <Text style={localStyles.sectionTitle}>
                Category & Subcategory
              </Text>
            </View>
            <TouchableOpacity
              style={localStyles.selector}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Icon name="folder" size={20} color="#9ca3af" />
              <Text
                style={[
                  localStyles.selectorText,
                  !selectedCategory && localStyles.placeholderText,
                ]}
              >
                {selectedCategory?.category || 'Select Category'}
              </Text>
              <Icon name="keyboard-arrow-down" size={24} color="#9ca3af" />
            </TouchableOpacity>
            {selectedCategory && (
              <TouchableOpacity
                style={[localStyles.selector, { marginTop: 12 }]}
                onPress={() => setSubcategoryModalVisible(true)}
              >
                <Icon
                  name="subdirectory-arrow-right"
                  size={20}
                  color="#9ca3af"
                />
                <Text
                  style={[
                    localStyles.selectorText,
                    !selectedSubcategory && localStyles.placeholderText,
                  ]}
                >
                  {selectedSubcategory?.name || 'Select Subcategory'}
                </Text>
                <Icon name="keyboard-arrow-down" size={24} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* SECTION 2: ADD VARIANT BUTTON & LIST */}
          {selectedSubcategory && (
            <View style={localStyles.sectionCard}>
              <View style={localStyles.sectionHeader}>
                <View style={localStyles.sectionIconBg}>
                  <Icon name="style" size={20} color="#8b5cf6" />
                </View>
                <Text style={localStyles.sectionTitle}>Variants</Text>
                <View style={localStyles.badge}>
                  <Text style={localStyles.badgeText}>
                    {formData.variants.length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={localStyles.addVariantBtn}
                onPress={addVariant}
              >
                <Icon name="add-circle" size={24} color="#fff" />
                <Text style={localStyles.addVariantBtnText}>Add Variant</Text>
              </TouchableOpacity>
              {formData.variants.length > 0 && (
                <View style={localStyles.variantsList}>
                  {formData.variants.map((v, idx) => (
                    <View key={idx} style={localStyles.variantListItem}>
                      <View style={localStyles.variantListItemLeft}>
                        <View style={localStyles.variantListBadge}>
                          <Text style={localStyles.variantListBadgeText}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View>
                          <Text style={localStyles.variantListTitle}>
                            {Object.entries(v.fields)
                              .map(([k, val]) => `${k}: ${val}`)
                              .join(' | ')}
                          </Text>
                          <Text style={localStyles.variantListPrice}>
                            MRP: ₹{formatPrice(v.mrp)} | Price: ₹
                            {formatPrice(v.price)} | Saved: ₹
                            {formatPrice(v.savedAmount)} | Discount:{' '}
                            {v.discount}%
                          </Text>
                          <View style={localStyles.variantGstBadge}>
                            <Icon
                              name={
                                v.gstType === 'INCLUSIVE'
                                  ? 'check-circle'
                                  : 'receipt'
                              }
                              size={10}
                              color="#f59e0b"
                            />
                            <Text style={{ marginLeft: 4 }}>
                              {v.gstType === 'INCLUSIVE'
                                ? 'GST Inclusive'
                                : 'GST Exclusive'}{' '}
                              | Rate: {v.gstRate}% | GST: ₹{v.gstAmount || 0}
                            </Text>
                          </View>
                          <View style={localStyles.variantMediaCount}>
                            <Icon
                              name="photo-camera"
                              size={10}
                              color="#6b7280"
                            />
                            <Text style={{ marginLeft: 4 }}>
                              {v.images.length} image(s)
                            </Text>
                            {v.video && (
                              <>
                                <Icon
                                  name="videocam"
                                  size={10}
                                  color="#6b7280"
                                  style={{ marginLeft: 8 }}
                                />
                                <Text style={{ marginLeft: 4 }}>Video</Text>
                              </>
                            )}
                          </View>
                          <View style={localStyles.variantDimensionText}>
                            <Icon name="inventory" size={10} color="#8b5cf6" />
                            <Text style={{ marginLeft: 4 }}>
                              {v.weight} {v.weightUnit} | {v.length}x{v.width}x
                              {v.height} {v.dimensionUnit}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={localStyles.variantListActions}>
                        <TouchableOpacity
                          style={localStyles.variantListEdit}
                          onPress={() => editVariant(idx)}
                        >
                          <Icon name="edit" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={localStyles.variantListDelete}
                          onPress={() => removeVariant(idx)}
                        >
                          <Icon name="delete" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* SECTION 3: PRODUCT DETAILS */}
          <View style={localStyles.sectionCard}>
            <View style={localStyles.sectionHeader}>
              <View style={localStyles.sectionIconBg}>
                <Icon name="info" size={20} color="#f59e0b" />
              </View>
              <Text style={localStyles.sectionTitle}>Product Details</Text>
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>
                Product Title <Text style={localStyles.required}>*</Text>
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="Enter product title"
                value={formData.title}
                onChangeText={v => setFormData(p => ({ ...p, title: v }))}
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Brand</Text>
              <TextInput
                style={localStyles.input}
                placeholder="Enter brand name"
                value={formData.brand}
                onChangeText={v => setFormData(p => ({ ...p, brand: v }))}
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Description</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea]}
                placeholder="Product description"
                multiline
                value={formData.description}
                onChangeText={v => setFormData(p => ({ ...p, description: v }))}
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Short Description</Text>
              <TextInput
                style={[localStyles.input, localStyles.textAreaSmall]}
                placeholder="Brief description"
                multiline
                value={formData.shortDescription}
                onChangeText={v =>
                  setFormData(p => ({ ...p, shortDescription: v }))
                }
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Full Description</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea]}
                placeholder="Detailed description"
                multiline
                value={formData.fullDescription}
                onChangeText={v =>
                  setFormData(p => ({ ...p, fullDescription: v }))
                }
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Highlights</Text>
              <TextInput
                style={localStyles.input}
                placeholder="Feature 1, Feature 2, Feature 3"
                value={formData.highlights.join(', ')}
                onChangeText={v =>
                  setFormData(p => ({
                    ...p,
                    highlights: v
                      .split(',')
                      .map(h => h.trim())
                      .filter(h => h.length > 0),
                  }))
                }
              />
            </View>
          </View>

          {/* SECTION 4: SPECIFICATIONS */}
          {selectedSubcategory?.specs &&
            selectedSubcategory.specs.length > 0 && (
              <View style={localStyles.sectionCard}>
                <View style={localStyles.sectionHeader}>
                  <View style={localStyles.sectionIconBg}>
                    <Icon name="settings" size={20} color="#06b6d4" />
                  </View>
                  <Text style={localStyles.sectionTitle}>Specifications</Text>
                </View>
                {selectedSubcategory.specs.map((spec: string) => (
                  <View key={spec} style={localStyles.inputGroup}>
                    <Text style={localStyles.inputLabel}>{spec}</Text>
                    <TextInput
                      style={localStyles.input}
                      placeholder={`Enter ${spec}`}
                      value={formData.specs[spec] || ''}
                      onChangeText={val =>
                        setFormData(p => ({
                          ...p,
                          specs: { ...p.specs, [spec]: val },
                        }))
                      }
                    />
                  </View>
                ))}
              </View>
            )}

          {/* SECTION 5: DELIVERY & POLICY */}
          <View style={localStyles.sectionCard}>
            <View style={localStyles.sectionHeader}>
              <View style={localStyles.sectionIconBg}>
                <Icon name="local-shipping" size={20} color="#8b5cf6" />
              </View>
              <Text style={localStyles.sectionTitle}>Delivery & Policy</Text>
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Delivery Time</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 3-4 days"
                value={formData.deliveryTime}
                onChangeText={v =>
                  setFormData(p => ({ ...p, deliveryTime: v }))
                }
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Warranty</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 1 year"
                value={formData.warranty}
                onChangeText={v => setFormData(p => ({ ...p, warranty: v }))}
              />
            </View>
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>Return Policy</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 7 days"
                value={formData.returnPolicy}
                onChangeText={v =>
                  setFormData(p => ({ ...p, returnPolicy: v }))
                }
              />
            </View>
          </View>

          {/* SECTION 6: FULFILLMENT TYPE */}
          <View style={localStyles.sectionCard}>
            <View style={localStyles.sectionHeader}>
              <View style={localStyles.sectionIconBg}>
                <Icon name="local-shipping" size={20} color="#10b981" />
              </View>
              <Text style={localStyles.sectionTitle}>Fulfillment Type</Text>
            </View>
            <View style={localStyles.fulfillmentContainer}>
              <TouchableOpacity
                style={[
                  localStyles.fulfillmentOption,
                  formData.fulfillmentType === 'SELLER' &&
                    localStyles.fulfillmentOptionActive,
                ]}
                onPress={() =>
                  setFormData(p => ({ ...p, fulfillmentType: 'SELLER' }))
                }
              >
                <View style={localStyles.fulfillmentRadio}>
                  {formData.fulfillmentType === 'SELLER' && (
                    <View style={localStyles.fulfillmentRadioSelected} />
                  )}
                </View>
                <View style={localStyles.fulfillmentContent}>
                  <Text style={localStyles.fulfillmentTitle}>
                    Seller Fulfilled
                  </Text>
                  <Text style={localStyles.fulfillmentDesc}>
                    You will handle shipping and delivery directly
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  localStyles.fulfillmentOption,
                  formData.fulfillmentType === 'FWS' &&
                    localStyles.fulfillmentOptionActive,
                ]}
                onPress={() =>
                  setFormData(p => ({ ...p, fulfillmentType: 'FWS' }))
                }
              >
                <View style={localStyles.fulfillmentRadio}>
                  {formData.fulfillmentType === 'FWS' && (
                    <View style={localStyles.fulfillmentRadioSelected} />
                  )}
                </View>
                <View style={localStyles.fulfillmentContent}>
                  <Text style={localStyles.fulfillmentTitle}>
                    FWS Fulfilled
                  </Text>
                  <Text style={localStyles.fulfillmentDesc}>
                    TizzyGo-OS will handle storage, packing & delivery
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 7: PRODUCT FEATURES */}
          <View style={localStyles.sectionCard}>
            <View style={localStyles.sectionHeader}>
              <View style={localStyles.sectionIconBg}>
                <Icon name="star" size={20} color="#ec4899" />
              </View>
              <Text style={localStyles.sectionTitle}>Product Features</Text>
            </View>
            <ToggleRow
              label="Free Delivery"
              icon="local-shipping"
              value={formData.freeDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, freeDelivery: val }))
              }
              description="Free shipping on this product"
            />
            <ToggleRow
              label="Fast Delivery"
              icon="flash-on"
              value={formData.fastDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, fastDelivery: val }))
              }
              description="Priority shipping within 24 hours"
            />
            <ToggleRow
              label="Cash on Delivery"
              icon="payments"
              value={formData.cashOnDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, cashOnDelivery: val }))
              }
              description="Pay when you receive the product"
            />
            <ToggleRow
              label="Protect Promise"
              icon="security"
              value={formData.protectPromiseFees}
              onValueChange={val =>
                setFormData(p => ({ ...p, protectPromiseFees: val }))
              }
              description="Additional protection coverage"
            />
            <ToggleRow
              label="Safety Certified"
              icon="verified"
              value={formData.safety}
              onValueChange={val => setFormData(p => ({ ...p, safety: val }))}
              description="Safety standards certified"
            />
            <ToggleRow
              label="Premium Quality"
              icon="grade"
              value={formData.productQuality}
              onValueChange={val =>
                setFormData(p => ({ ...p, productQuality: val }))
              }
              description="High quality assurance"
            />
            <ToggleRow
              label="Flexible Payment"
              icon="credit-card"
              value={formData.paymentOptions}
              onValueChange={val =>
                setFormData(p => ({ ...p, paymentOptions: val }))
              }
              description="Multiple payment methods accepted"
            />
            <ToggleRow
              label="Manufacturer Warranty"
              icon="factory"
              value={formData.manufacturer}
              onValueChange={val =>
                setFormData(p => ({ ...p, manufacturer: val }))
              }
              description="Direct manufacturer warranty"
            />
            <ToggleRow
              label="Special Delivery"
              icon="local-taxi"
              value={formData.deliveryVehicleType}
              onValueChange={val =>
                setFormData(p => ({ ...p, deliveryVehicleType: val }))
              }
              description="Special delivery vehicle"
            />
          </View>

          {/* SECTION 8: SELLER LOCATION */}
          <View style={localStyles.sectionCard}>
            <SellerInformation
              sellerLocation={formData.sellerLocation}
              onSellerLocationChange={handleSellerLocationChange}
            />
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[localStyles.submitBtn, loading && localStyles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={22} color="#fff" />
                <Text style={localStyles.submitText}>Create Product</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODALS */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={localStyles.modalContainer}>
          <View style={localStyles.modalHeader}>
            <Text style={localStyles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={localStyles.modalItem}
                onPress={() => handleCategorySelect(item)}
              >
                <Icon name="folder" size={22} color="#6366f1" />
                <Text style={localStyles.modalItemText}>{item.category}</Text>
                <Icon name="chevron-right" size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={subcategoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={localStyles.modalContainer}>
          <View style={localStyles.modalHeader}>
            <Text style={localStyles.modalTitle}>Select Subcategory</Text>
            <TouchableOpacity onPress={() => setSubcategoryModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={selectedCategory?.subcategories || []}
            keyExtractor={(item, i) => item.name + i}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={localStyles.modalItem}
                onPress={() => handleSubcategorySelect(item)}
              >
                <Icon
                  name="subdirectory-arrow-right"
                  size={22}
                  color="#8b5cf6"
                />
                <Text style={localStyles.modalItemText}>{item.name}</Text>
                <Icon name="chevron-right" size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Variant Modal */}
      <Modal
        visible={variantModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={localStyles.modalContainer}>
          <View style={localStyles.modalHeader}>
            <Text style={localStyles.modalTitle}>
              {editingVariantIndex !== null ? 'Edit Variant' : 'Add Variant'}
            </Text>
            <TouchableOpacity onPress={() => setVariantModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={localStyles.modalBody}>
              {/* Variant Attributes */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  Variant Attributes
                </Text>
                {(selectedSubcategory?.variantOptions || []).map(
                  (opt: string) => (
                    <View key={opt} style={localStyles.inputGroup}>
                      <Text style={localStyles.inputLabel}>
                        {opt} <Text style={localStyles.required}>*</Text>
                      </Text>
                      <View style={localStyles.chipWrap}>
                        {(formData.variantValues[opt] || []).map(
                          (val: string) => (
                            <TouchableOpacity
                              key={val}
                              style={[
                                localStyles.chip,
                                currentVariant.fields[opt] === val &&
                                  localStyles.chipActive,
                              ]}
                              onPress={() =>
                                setCurrentVariant(p => ({
                                  ...p,
                                  fields: { ...p.fields, [opt]: val },
                                }))
                              }
                            >
                              <Text
                                style={[
                                  localStyles.chipText,
                                  currentVariant.fields[opt] === val &&
                                    localStyles.chipTextActive,
                                ]}
                              >
                                {val}
                              </Text>
                            </TouchableOpacity>
                          ),
                        )}
                        <TextInput
                          style={[
                            localStyles.input,
                            { flex: 1, minWidth: 100 },
                          ]}
                          placeholder={`Enter ${opt}`}
                          value={currentVariant.fields[opt] || ''}
                          onChangeText={val =>
                            setCurrentVariant(p => ({
                              ...p,
                              fields: { ...p.fields, [opt]: val },
                            }))
                          }
                        />
                      </View>
                    </View>
                  ),
                )}
              </View>

              <View style={localStyles.divider} />

              {/* SKU & Quantity */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  SKU & Quantity
                </Text>
                <View style={localStyles.pricingNoteBox}>
                  <Icon name="info" size={16} color="#3b82f6" />
                  <Text style={localStyles.pricingNoteText}>
                    SKU will be auto-generated by the system. Leave it empty.
                  </Text>
                </View>
              </View>

              <View style={localStyles.row}>
                <View style={localStyles.half}>
                  <Text style={localStyles.inputLabel}>
                    SKU (Auto-generated)
                  </Text>
                  <View style={localStyles.disabledInputWrapper}>
                    <Text style={localStyles.disabledInputText}>
                      {currentVariant.sku || 'Will be generated automatically'}
                    </Text>
                  </View>
                </View>
                <View style={localStyles.half}>
                  <Text style={localStyles.inputLabel}>Quantity Available</Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="Stock quantity"
                    keyboardType="numeric"
                    value={String(currentVariant.quantityAvailable)}
                    onChangeText={v =>
                      updateVariantField('quantityAvailable', Number(v) || 0)
                    }
                  />
                </View>
              </View>

              {/* Weight with Unit Toggle */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  Weight & Dimensions
                </Text>
                <WeightUnitToggle
                  weightUnit={currentVariant.weightUnit}
                  onWeightUnitChange={unit =>
                    setCurrentVariant(prev => ({ ...prev, weightUnit: unit }))
                  }
                />
                <View style={localStyles.inputGroup}>
                  <Text style={localStyles.inputLabel}>
                    Weight <Text style={localStyles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder={`Enter weight in ${currentVariant.weightUnit}`}
                    keyboardType="numeric"
                    value={currentVariant.weight}
                    onChangeText={v =>
                      setCurrentVariant(prev => ({ ...prev, weight: v }))
                    }
                  />
                </View>
              </View>

              {/* Dimensions */}
              <View style={localStyles.modalSection}>
                <DimensionUnitToggle
                  dimensionUnit={currentVariant.dimensionUnit}
                  onDimensionUnitChange={unit =>
                    setCurrentVariant(prev => ({
                      ...prev,
                      dimensionUnit: unit,
                    }))
                  }
                />
                <Text style={localStyles.inputLabel}>
                  Dimensions (H x W x L){' '}
                  <Text style={localStyles.required}>*</Text>
                </Text>
                <View style={localStyles.dimRow}>
                  <TextInput
                    style={localStyles.dimInput}
                    placeholder="H"
                    keyboardType="numeric"
                    value={currentVariant.height}
                    onChangeText={v =>
                      setCurrentVariant(prev => ({ ...prev, height: v }))
                    }
                  />
                  <TextInput
                    style={localStyles.dimInput}
                    placeholder="W"
                    keyboardType="numeric"
                    value={currentVariant.width}
                    onChangeText={v =>
                      setCurrentVariant(prev => ({ ...prev, width: v }))
                    }
                  />
                  <TextInput
                    style={localStyles.dimInput}
                    placeholder="L"
                    keyboardType="numeric"
                    value={currentVariant.length}
                    onChangeText={v =>
                      setCurrentVariant(prev => ({ ...prev, length: v }))
                    }
                  />
                </View>
                <Text style={localStyles.unitHintText}>
                  Unit: {currentVariant.dimensionUnit}
                </Text>
              </View>

              {/* GST Configuration */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  GST Configuration
                </Text>
                <GSTToggle
                  gstType={currentVariant.gstType}
                  onGSTTypeChange={type => {
                    console.log('🔄 GST Type changing to:', type);
                    setCurrentVariant(prev => ({ ...prev, gstType: type }));
                  }}
                />
              </View>

              {/* Pricing Section */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>Pricing</Text>
                <View style={localStyles.pricingNoteBox}>
                  <Icon name="info" size={16} color="#3b82f6" />
                  <Text style={localStyles.pricingNoteText}>
                    Discount, Saved Amount & Final Price will be calculated
                    automatically by BACKEND
                  </Text>
                </View>

                <View style={localStyles.row}>
                  <View style={localStyles.half}>
                    <Text style={localStyles.inputLabel}>
                      MRP <Text style={localStyles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={localStyles.input}
                      placeholder="Enter MRP"
                      keyboardType="numeric"
                      value={String(currentVariant.mrp)}
                      onChangeText={v =>
                        updateVariantField('mrp', Number(v) || 0)
                      }
                    />
                    {currentVariant.mrp > 0 && (
                      <Text style={localStyles.formattedPriceHint}>
                        ₹{formatPrice(currentVariant.mrp)}
                      </Text>
                    )}
                  </View>
                  <View style={localStyles.half}>
                    <Text style={localStyles.inputLabel}>
                      Base Price <Text style={localStyles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={localStyles.input}
                      placeholder="Enter Base Price"
                      keyboardType="numeric"
                      value={String(currentVariant.price)}
                      onChangeText={v =>
                        updateVariantField('price', Number(v) || 0)
                      }
                    />
                    {currentVariant.price > 0 && (
                      <Text style={localStyles.formattedPriceHint}>
                        ₹{formatPrice(currentVariant.price)}
                      </Text>
                    )}
                  </View>
                </View>

                <PricePreview
                  mrp={currentVariant.mrp}
                  price={currentVariant.price}
                  gstType={currentVariant.gstType}
                  category={formData.category}
                  subcategory={formData.subcategory}
                  onPricingCalculated={handlePricingCalculated}
                />
              </View>

              <View style={localStyles.inputGroup}>
                <Text style={localStyles.inputLabel}>
                  Offer Text (Optional)
                </Text>
                <TextInput
                  style={localStyles.input}
                  placeholder="e.g., Bank Offer, Festival Sale"
                  value={currentVariant.offerText}
                  onChangeText={v =>
                    setCurrentVariant(p => ({ ...p, offerText: v }))
                  }
                />
              </View>

              {/* Images Section */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  Images <Text style={localStyles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={localStyles.mediaBtn}
                  onPress={handleVariantImageSelect}
                >
                  <Icon name="add-a-photo" size={20} color="#fff" />
                  <Text style={localStyles.mediaBtnText}>Select Images</Text>
                </TouchableOpacity>

                {(currentVariant.localImages.length > 0 ||
                  currentVariant.images.length > 0) && (
                  <ScrollView horizontal style={localStyles.imageScroll}>
                    {currentVariant.localImages.map((uri, i) => (
                      <View key={i} style={localStyles.imageBox}>
                        <Image source={{ uri }} style={localStyles.image} />
                        <TouchableOpacity
                          style={localStyles.imageRemove}
                          onPress={() => removeVariantImage(i)}
                        >
                          <Icon name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                        <View style={localStyles.pendingBadge}>
                          <Text style={localStyles.pendingBadgeText}>
                            Pending
                          </Text>
                        </View>
                      </View>
                    ))}
                    {currentVariant.images.map((url, i) => (
                      <View key={`uploaded_${i}`} style={localStyles.imageBox}>
                        <Image
                          source={{ uri: url }}
                          style={localStyles.image}
                        />
                        <View style={localStyles.uploadedBadge}>
                          <Icon name="check" size={10} color="#fff" />
                          <Text style={localStyles.uploadedBadgeText}>
                            Uploaded
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Video Section */}
              <View style={localStyles.modalSection}>
                <Text style={localStyles.modalSectionTitle}>
                  Video (Optional)
                </Text>
                <TouchableOpacity
                  style={[localStyles.mediaBtn, { backgroundColor: '#ef4444' }]}
                  onPress={handleVariantVideoSelect}
                >
                  <Icon name="videocam" size={20} color="#fff" />
                  <Text style={localStyles.mediaBtnText}>
                    {currentVariant.localVideo ? 'Change Video' : 'Add Video'}
                  </Text>
                </TouchableOpacity>
                {currentVariant.localVideo && (
                  <VideoPreview
                    videoUri={currentVariant.localVideo}
                    onRemove={removeVariantVideo}
                    isUploaded={false}
                  />
                )}
                {currentVariant.video && !currentVariant.localVideo && (
                  <VideoPreview
                    videoUri={currentVariant.video}
                    onRemove={removeVariantVideo}
                    isUploaded={true}
                  />
                )}
              </View>

              {/* Status Toggles */}
              <View style={localStyles.variantToggleSection}>
                <Text style={localStyles.modalSectionTitle}>
                  Variant Status
                </Text>
                <ToggleRow
                  label="In Stock"
                  icon="inventory"
                  value={currentVariant.inStock}
                  onValueChange={v => updateVariantField('inStock', v)}
                  description="Product available for sale"
                />
                <ToggleRow
                  label="Default Variant"
                  icon="star"
                  value={currentVariant.isDefault}
                  onValueChange={v => updateVariantField('isDefault', v)}
                  description="This variant will be shown first"
                />
              </View>

              <TouchableOpacity
                style={localStyles.saveBtn}
                onPress={saveVariant}
              >
                <Icon name="check-circle" size={22} color="#fff" />
                <Text style={localStyles.saveBtnText}>
                  {editingVariantIndex !== null
                    ? 'Update Variant'
                    : 'Save Variant'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* UPLOAD PROGRESS MODAL - AB YAHAN SIRF IMPORT HOGA */}
      <UploadProgressModal
        visible={uploading}
        progress={uploadProgress}
        isTakingLong={isTakingLong}
      />
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  headerBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  sectionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b', flex: 1 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fafafa',
    gap: 12,
  },
  selectorText: { flex: 1, fontSize: 15, color: '#1e293b' },
  placeholderText: { color: '#94a3b8' },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  required: { color: '#ef4444' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1e293b',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  textAreaSmall: { height: 70, textAlignVertical: 'top' },
  formattedPriceHint: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 4,
    marginLeft: 4,
  },
  badge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 14, fontWeight: '600', color: '#6366f1' },
  variantMediaCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  variantDimensionText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  variantGstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  addVariantBtn: {
    backgroundColor: '#8b5cf6',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  addVariantBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  variantsList: { marginTop: 8 },
  variantListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  variantListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  variantListBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantListBadgeText: { fontSize: 13, fontWeight: '600', color: '#6366f1' },
  variantListTitle: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  variantListPrice: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  variantListActions: { flexDirection: 'row', gap: 8 },
  variantListEdit: {
    backgroundColor: '#3b82f6',
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantListDelete: {
    backgroundColor: '#ef4444',
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRowLabel: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  toggleRowDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  variantToggleSection: { marginTop: 8, marginBottom: 16 },
  submitBtn: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  disabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  modalItemText: { flex: 1, fontSize: 16, color: '#1e293b' },
  modalBody: { padding: 20 },
  modalSection: { marginBottom: 24 },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  half: { flex: 1 },
  dimRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dimInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  unitHintText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  mediaBtn: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  imageScroll: { flexDirection: 'row', marginTop: 12 },
  imageBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    position: 'relative',
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: { fontSize: 8, color: '#fff', fontWeight: '600' },
  uploadedBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  uploadedBadgeText: { fontSize: 8, color: '#fff', fontWeight: '600' },
  videoPreviewContainer: { marginTop: 12 },
  videoPreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoThumbnailWrapper: { position: 'relative', width: '100%', height: 200 },
  videoThumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerWrapper: { width: '100%', height: 200, position: 'relative' },
  videoPlayer: { width: '100%', height: '100%' },
  closeVideoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoRemoveButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  videoRemoveText: { color: '#ef4444', fontSize: 12, fontWeight: '500' },
  videoUploadedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoUploadedText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  videoPendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoPendingText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pricingNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  pricingNoteText: { fontSize: 12, color: '#3b82f6', flex: 1 },
  disabledInputWrapper: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f3f4f6',
  },
  disabledInputText: { fontSize: 15, color: '#6b7280' },
  fulfillmentContainer: { gap: 12 },
  fulfillmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  fulfillmentOptionActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  fulfillmentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fulfillmentRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  fulfillmentContent: { flex: 1 },
  fulfillmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  fulfillmentDesc: { fontSize: 12, color: '#64748b' },
  gstContainer: { marginBottom: 8 },
  gstLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  gstToggleWrapper: { gap: 12 },
  gstOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  gstOptionActive: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  gstRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gstRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  gstContent: { flex: 1 },
  gstTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  gstTitleActive: { color: '#f59e0b' },
  gstDesc: { fontSize: 11, color: '#94a3b8' },
  unitToggleContainer: { marginBottom: 16 },
  unitToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  unitToggleWrapper: { flexDirection: 'row', gap: 12 },
  unitOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  unitOptionActive: { borderColor: '#8b5cf6', backgroundColor: '#ede9fe' },
  unitOptionText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  unitOptionTextActive: { color: '#8b5cf6' },
  pricePreviewContainer: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pricePreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 10,
  },
  pricePreviewPlaceholder: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  pricePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pricePreviewLabel: { fontSize: 12, color: '#64748b' },
  pricePreviewValue: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  pricePreviewTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pricePreviewTotalLabel: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  pricePreviewTotalValue: { fontSize: 16, fontWeight: '800', color: '#10b981' },
  gstInfoRow: {
    backgroundColor: '#fef3c7',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pricePreviewGstInfo: { fontSize: 11, fontWeight: '500', color: '#f59e0b' },
});

export default ProductForm;