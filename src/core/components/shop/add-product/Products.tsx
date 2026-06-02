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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SellerInformation, SellerLocation } from './SellerInformation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { launchImageLibrary } from 'react-native-image-picker';
import LottieView from 'lottie-react-native';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

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
  height: string;
  width: string;
  length: string;
  inStock: boolean;
  quantityAvailable: number;
  images: string[];
  video: string | null;
  isDefault: boolean;
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
}

// ==================== CUSTOM TOGGLE COMPONENT (Improved) ====================
interface CustomToggleProps {
  label: string;
  icon: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
}

const CustomToggle: React.FC<CustomToggleProps> = ({
  label,
  icon,
  value,
  onValueChange,
  description,
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const TOGGLE_COLOR = '#3b82f6';

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [value]);

  const toggleBackground = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e2e8f0', TOGGLE_COLOR],
  });

  const toggleKnob = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 28],
  });

  return (
    <TouchableOpacity
      style={styles.customToggleContainer}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={styles.customToggleLeft}>
        <View
          style={[
            styles.customToggleIcon,
            { backgroundColor: TOGGLE_COLOR + '15' },
          ]}
        >
          <Icon name={icon} size={20} color={TOGGLE_COLOR} />
        </View>
        <View>
          <Text style={styles.customToggleLabel}>{label}</Text>
          {description && (
            <Text style={styles.customToggleDesc}>{description}</Text>
          )}
        </View>
      </View>
      <View style={styles.customToggleSwitch}>
        <Animated.View
          style={[
            styles.customToggleTrack,
            { backgroundColor: toggleBackground },
          ]}
        >
          <Animated.View
            style={[
              styles.customToggleKnob,
              { transform: [{ translateX: toggleKnob }] },
            ]}
          />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
};

// ==================== FORMAT PRICE WITH COMMAS ====================
const formatPrice = (price: number): string => {
  if (isNaN(price) || price === 0) return '';
  return new Intl.NumberFormat('en-IN').format(price);
};

// ==================== HELPERS ====================
const pickMultipleImages = async (): Promise<{ uri: string }[]> => {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 10, quality: 0.8 },
      response => {
        if (response.didCancel) resolve([]);
        else if (response.errorCode) reject(new Error(response.errorMessage));
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
        else if (response.errorCode) reject(new Error(response.errorMessage));
        else if (response.assets && response.assets[0])
          resolve({ uri: response.assets[0].uri || '' });
        else resolve(null);
      },
    );
  });
};

// Generate video thumbnail from URI
const generateVideoThumbnail = async (
  videoUri: string,
): Promise<string | null> => {
  // For now return null, can implement with react-native-video-thumbnail
  return null;
};

// ==================== UPLOAD PROGRESS COMPONENT ====================
interface UploadProgressModalProps {
  visible: boolean;
  progress: {
    total: number;
    uploaded: number;
    percent: number;
  };
  isTakingLong: boolean;
}

const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  visible,
  progress,
  isTakingLong,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [lineColor, setLineColor] = useState('#3b82f6');

  useEffect(() => {
    if (visible) {
      Animated.timing(progressAnim, {
        toValue: progress.percent,
        duration: 300,
        useNativeDriver: false,
      }).start();

      if (progress.percent < 33) {
        setLineColor('#ef4444');
      } else if (progress.percent < 66) {
        setLineColor('#3b82f6');
      } else {
        setLineColor('#10b981');
      }
    }
  }, [progress.percent, visible]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fullScreenUploadOverlay}>
        <View style={styles.fullScreenUploadCard}>
          <LottieView
            source={require('../../animations/lotties/Uploading to cloud.json')}
            autoPlay
            loop
            style={styles.uploadLottie}
          />
          <Text style={styles.fullScreenUploadTitle}>Uploading Files</Text>
          <Text style={styles.fullScreenUploadText}>
            {progress.uploaded} of {progress.total} files uploaded
          </Text>
          <View style={styles.fullScreenProgressBar}>
            <Animated.View
              style={[
                styles.fullScreenProgressFill,
                {
                  width: animatedWidth,
                  backgroundColor: lineColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.fullScreenUploadPercent, { color: lineColor }]}>
            {progress.percent}%
          </Text>
          {isTakingLong && (
            <Text style={styles.takingLongText}>
              Taking longer than expected... Please wait
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ==================== VIDEO PREVIEW WITH THUMBNAIL ====================
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
  const [showPlayButton, setShowPlayButton] = useState(true);
  const [playing, setPlaying] = useState(false);

  if (!videoUri) return null;

  return (
    <View style={styles.videoPreviewContainer}>
      <View style={styles.videoPreviewWrapper}>
        {!playing ? (
          <TouchableOpacity
            style={styles.videoThumbnailWrapper}
            onPress={() => setPlaying(true)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: videoUri }}
              style={styles.videoThumbnail}
              resizeMode="cover"
            />
            <View style={styles.playButtonOverlay}>
              <View style={styles.playButtonCircle}>
                <Icon name="play-arrow" size={32} color="#fff" />
              </View>
            </View>
            <View style={styles.videoDurationBadge}>
              <Text style={styles.videoDurationText}>Preview</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.videoPlayerWrapper}>
            <Video
              source={{ uri: videoUri }}
              style={styles.videoPlayer}
              controls={true}
              paused={false}
              resizeMode="contain"
              onEnd={() => setPlaying(false)}
            />
            <TouchableOpacity
              style={styles.closeVideoButton}
              onPress={() => setPlaying(false)}
            >
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.videoRemoveButton} onPress={onRemove}>
          <Icon name="delete-outline" size={18} color="#ef4444" />
          <Text style={styles.videoRemoveText}>Remove</Text>
        </TouchableOpacity>
        {isUploaded && (
          <View style={styles.videoUploadedBadge}>
            <Icon name="check-circle" size={14} color="#10b981" />
            <Text style={styles.videoUploadedText}>Uploaded</Text>
          </View>
        )}
        {!isUploaded && !playing && (
          <View style={styles.videoPendingBadge}>
            <Text style={styles.videoPendingText}>Pending</Text>
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
    height: '',
    width: '',
    length: '',
    inStock: true,
    quantityAvailable: 0,
    images: [],
    video: null,
    isDefault: false,
    localImages: [],
    localVideo: null,
    videoThumbnail: null,
  });

  // ==================== PRICE CALCULATION PREVIEW ====================
  const calculatePricePreview = (mrp: number, price: number) => {
    if (mrp <= 0 || price <= 0) {
      return { discount: 0, savedAmount: 0, finalPrice: price || 0 };
    }
    const savedAmount = mrp - price;
    const discount = (savedAmount / mrp) * 100;
    return {
      savedAmount: Number(savedAmount.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      finalPrice: Number(price.toFixed(2)),
    };
  };

  // ✅ FIX: Auto-update preview when MRP or Price changes ONLY
  const updateVariantFieldWithPreview = (
    field: keyof Omit<
      FrontendVariant,
      'localImages' | 'localVideo' | 'videoThumbnail'
    >,
    value: any,
  ) => {
    setCurrentVariant(prev => {
      const updated = { ...prev, [field]: value };

      // Only recalculate pricing when MRP or Price changes
      if (field === 'mrp' || field === 'price') {
        const preview = calculatePricePreview(updated.mrp, updated.price);
        updated.savedAmount = preview.savedAmount;
        updated.discount = preview.discount;
        updated.finalPrice = preview.finalPrice;
      }

      return updated;
    });
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
      height: '',
      width: '',
      length: '',
      inStock: true,
      quantityAvailable: 0,
      images: [],
      video: null,
      isDefault: formData.variants.length === 0,
      localImages: [],
      localVideo: null,
      videoThumbnail: null,
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
      // Generate thumbnail for preview
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

  // ✅ FIX: Save variant with all dimensions preserved
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

    const preview = calculatePricePreview(
      currentVariant.mrp,
      currentVariant.price,
    );

    // ✅ FIX: Preserve all dimension values correctly
    const variantToSave: FrontendVariant = {
      ...currentVariant,
      savedAmount: preview.savedAmount,
      discount: preview.discount,
      finalPrice: preview.finalPrice,
      // Ensure dimensions are preserved as strings
      weight: currentVariant.weight || '',
      height: currentVariant.height || '',
      width: currentVariant.width || '',
      length: currentVariant.length || '',
    };

    const newVariantValues = { ...formData.variantValues };
    variantOptions.forEach(opt => {
      const val = variantToSave.fields[opt];
      if (val && !newVariantValues[opt]?.includes(val)) {
        newVariantValues[opt] = [...(newVariantValues[opt] || []), val];
      }
    });

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

      if (longUploadTimer.current) {
        clearTimeout(longUploadTimer.current);
      }

      return true;
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload Error', 'Failed to upload files. Please try again.');
      return false;
    } finally {
      setUploading(false);
      if (longUploadTimer.current) {
        clearTimeout(longUploadTimer.current);
      }
    }
  };

  // ==================== SUBMIT ====================
  // ✅ FIX: Submit with properly formatted payload
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

    setLoading(true);
    const uploaded = await uploadAllFiles();
    if (!uploaded) {
      setLoading(false);
      return;
    }

    // ✅ FIX: Ensure all fields are properly formatted
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
        // ✅ FIX: Ensure dimensions are included with proper values
        weight: v.weight || '',
        height: v.height || '',
        width: v.width || '',
        length: v.length || '',
        inStock: v.inStock,
        quantityAvailable: v.quantityAvailable,
        images: v.images,
        video: v.video,
        isDefault: v.isDefault,
      })),
      deliveryTime: formData.deliveryTime,
      warranty: formData.warranty,
      returnPolicy: formData.returnPolicy,
      shortDescription: formData.shortDescription,
      fullDescription: formData.fullDescription,
      // ✅ FIX: Ensure highlights are properly formatted
      highlights: formData.highlights.filter(h => h && h.trim().length > 0),
      sellerLocation: formData.sellerLocation,
      // ✅ FIX: Ensure specs is always an object, never null/undefined
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
    };

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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create product');
    }

    Alert.alert('Success', 'Product created successfully!');
    navigation.goBack();
    setLoading(false);
  };

  // ==================== RENDER ====================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <Icon name="inventory-2" size={28} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Add New Product</Text>
            <Text style={styles.headerSubtitle}>
              Create a new product listing
            </Text>
          </View>

          {/* SECTION 1: CATEGORY & SUBCATEGORY */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBg}>
                <Icon name="category" size={20} color="#6366f1" />
              </View>
              <Text style={styles.sectionTitle}>Category & Subcategory</Text>
            </View>

            <TouchableOpacity
              style={styles.selector}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Icon name="folder" size={20} color="#9ca3af" />
              <Text
                style={[
                  styles.selectorText,
                  !selectedCategory && styles.placeholderText,
                ]}
              >
                {selectedCategory?.category || 'Select Category'}
              </Text>
              <Icon name="keyboard-arrow-down" size={24} color="#9ca3af" />
            </TouchableOpacity>

            {selectedCategory && (
              <TouchableOpacity
                style={[styles.selector, { marginTop: 12 }]}
                onPress={() => setSubcategoryModalVisible(true)}
              >
                <Icon
                  name="subdirectory-arrow-right"
                  size={20}
                  color="#9ca3af"
                />
                <Text
                  style={[
                    styles.selectorText,
                    !selectedSubcategory && styles.placeholderText,
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
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBg}>
                  <Icon name="style" size={20} color="#8b5cf6" />
                </View>
                <Text style={styles.sectionTitle}>Variants</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {formData.variants.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.addVariantBtn}
                onPress={addVariant}
              >
                <Icon name="add-circle" size={24} color="#fff" />
                <Text style={styles.addVariantBtnText}>Add Variant</Text>
              </TouchableOpacity>

              {formData.variants.length > 0 && (
                <View style={styles.variantsList}>
                  {formData.variants.map((v, idx) => (
                    <View key={idx} style={styles.variantListItem}>
                      <View style={styles.variantListItemLeft}>
                        <View style={styles.variantListBadge}>
                          <Text style={styles.variantListBadgeText}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.variantListTitle}>
                            {Object.entries(v.fields)
                              .map(([k, val]) => `${k}: ${val}`)
                              .join(' | ')}
                          </Text>
                          <Text style={styles.variantListPrice}>
                            MRP: ₹{formatPrice(v.mrp)} | Base: ₹
                            {formatPrice(v.price)} | SKU:{' '}
                            {v.sku || 'Auto-generated'}
                          </Text>
                          <Text style={styles.variantListPriceNote}>
                            💡 Discount, Saved Amount & Final Price calculated
                            by backend
                          </Text>
                          <Text style={styles.variantMediaCount}>
                            📷 {v.images.length} image(s){' '}
                            {v.video && '| 🎥 Video'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.variantListActions}>
                        <TouchableOpacity
                          style={styles.variantListEdit}
                          onPress={() => editVariant(idx)}
                        >
                          <Icon name="edit" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.variantListDelete}
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
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBg}>
                <Icon name="info" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.sectionTitle}>Product Details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Product Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter product title"
                value={formData.title}
                onChangeText={v => setFormData(p => ({ ...p, title: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Brand</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter brand name"
                value={formData.brand}
                onChangeText={v => setFormData(p => ({ ...p, brand: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Product description"
                multiline
                value={formData.description}
                onChangeText={v => setFormData(p => ({ ...p, description: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Short Description</Text>
              <TextInput
                style={[styles.input, styles.textAreaSmall]}
                placeholder="Brief description"
                multiline
                value={formData.shortDescription}
                onChangeText={v =>
                  setFormData(p => ({ ...p, shortDescription: v }))
                }
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Detailed description"
                multiline
                value={formData.fullDescription}
                onChangeText={v =>
                  setFormData(p => ({ ...p, fullDescription: v }))
                }
              />
            </View>
            {/* ✅ FIX: Highlights with proper split, trim, and filter */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Highlights</Text>
              <TextInput
                style={styles.input}
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
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconBg}>
                    <Icon name="settings" size={20} color="#06b6d4" />
                  </View>
                  <Text style={styles.sectionTitle}>Specifications</Text>
                </View>
                {selectedSubcategory.specs.map((spec: string) => (
                  <View key={spec} style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{spec}</Text>
                    <TextInput
                      style={styles.input}
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
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBg}>
                <Icon name="local-shipping" size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.sectionTitle}>Delivery & Policy</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Time</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 3-4 days"
                value={formData.deliveryTime}
                onChangeText={v =>
                  setFormData(p => ({ ...p, deliveryTime: v }))
                }
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Warranty</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1 year"
                value={formData.warranty}
                onChangeText={v => setFormData(p => ({ ...p, warranty: v }))}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Return Policy</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 7 days"
                value={formData.returnPolicy}
                onChangeText={v =>
                  setFormData(p => ({ ...p, returnPolicy: v }))
                }
              />
            </View>
          </View>

          {/* SECTION 6: PRODUCT FEATURES */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBg}>
                <Icon name="star" size={20} color="#ec4899" />
              </View>
              <Text style={styles.sectionTitle}>Product Features</Text>
            </View>

            <CustomToggle
              label="Free Delivery"
              icon="local-shipping"
              value={formData.freeDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, freeDelivery: val }))
              }
              description="Free shipping on this product"
            />
            <CustomToggle
              label="Fast Delivery"
              icon="flash-on"
              value={formData.fastDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, fastDelivery: val }))
              }
              description="Priority shipping within 24 hours"
            />
            <CustomToggle
              label="Cash on Delivery"
              icon="payments"
              value={formData.cashOnDelivery}
              onValueChange={val =>
                setFormData(p => ({ ...p, cashOnDelivery: val }))
              }
              description="Pay when you receive the product"
            />
            <CustomToggle
              label="Protect Promise"
              icon="security"
              value={formData.protectPromiseFees}
              onValueChange={val =>
                setFormData(p => ({ ...p, protectPromiseFees: val }))
              }
              description="Additional protection coverage"
            />
            <CustomToggle
              label="Safety Certified"
              icon="verified"
              value={formData.safety}
              onValueChange={val => setFormData(p => ({ ...p, safety: val }))}
              description="Safety standards certified"
            />
            <CustomToggle
              label="Premium Quality"
              icon="grade"
              value={formData.productQuality}
              onValueChange={val =>
                setFormData(p => ({ ...p, productQuality: val }))
              }
              description="High quality assurance"
            />
            <CustomToggle
              label="Flexible Payment"
              icon="credit-card"
              value={formData.paymentOptions}
              onValueChange={val =>
                setFormData(p => ({ ...p, paymentOptions: val }))
              }
              description="Multiple payment methods accepted"
            />
            <CustomToggle
              label="Manufacturer Warranty"
              icon="factory"
              value={formData.manufacturer}
              onValueChange={val =>
                setFormData(p => ({ ...p, manufacturer: val }))
              }
              description="Direct manufacturer warranty"
            />
            <CustomToggle
              label="Special Delivery"
              icon="local-taxi"
              value={formData.deliveryVehicleType}
              onValueChange={val =>
                setFormData(p => ({ ...p, deliveryVehicleType: val }))
              }
              description="Special delivery vehicle"
            />
          </View>

          {/* SECTION 7: SELLER LOCATION */}
          <SellerInformation
            sellerLocation={formData.sellerLocation}
            onSellerLocationChange={(field: keyof SellerLocation, value: any) =>
              setFormData(p => ({
                ...p,
                sellerLocation: { ...p.sellerLocation, [field]: value },
              }))
            }
          />

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={22} color="#fff" />
                <Text style={styles.submitText}>Create Product</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODALS */}
      {/* Category Modal */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => handleCategorySelect(item)}
              >
                <Icon name="folder" size={22} color="#6366f1" />
                <Text style={styles.modalItemText}>{item.category}</Text>
                <Icon name="chevron-right" size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        visible={subcategoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Subcategory</Text>
            <TouchableOpacity onPress={() => setSubcategoryModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={selectedCategory?.subcategories || []}
            keyExtractor={(item, i) => item.name + i}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => handleSubcategorySelect(item)}
              >
                <Icon
                  name="subdirectory-arrow-right"
                  size={22}
                  color="#8b5cf6"
                />
                <Text style={styles.modalItemText}>{item.name}</Text>
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingVariantIndex !== null ? 'Edit Variant' : 'Add Variant'}
            </Text>
            <TouchableOpacity onPress={() => setVariantModalVisible(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalBody}>
              {/* Variant Attributes */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Variant Attributes</Text>
                {(selectedSubcategory?.variantOptions || []).map(
                  (opt: string) => (
                    <View key={opt} style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>
                        {opt} <Text style={styles.required}>*</Text>
                      </Text>
                      <View style={styles.chipWrap}>
                        {(formData.variantValues[opt] || []).map(
                          (val: string) => (
                            <TouchableOpacity
                              key={val}
                              style={[
                                styles.chip,
                                currentVariant.fields[opt] === val &&
                                  styles.chipActive,
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
                                  styles.chipText,
                                  currentVariant.fields[opt] === val &&
                                    styles.chipTextActive,
                                ]}
                              >
                                {val}
                              </Text>
                            </TouchableOpacity>
                          ),
                        )}
                        <TextInput
                          style={[styles.input, { flex: 1, minWidth: 100 }]}
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

              <View style={styles.divider} />

              {/* SKU - DISABLED (Auto-generated) */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>SKU & Quantity</Text>
                <View style={styles.pricingNoteBox}>
                  <Icon name="info" size={16} color="#3b82f6" />
                  <Text style={styles.pricingNoteText}>
                    SKU will be auto-generated by the system. Leave it empty.
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.inputLabel}>SKU (Auto-generated)</Text>
                  <View style={styles.disabledInputWrapper}>
                    <Text style={styles.disabledInputText}>
                      {currentVariant.sku || 'Will be generated automatically'}
                    </Text>
                  </View>
                </View>
                <View style={styles.half}>
                  <Text style={styles.inputLabel}>Quantity Available</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Stock quantity"
                    keyboardType="numeric"
                    value={String(currentVariant.quantityAvailable)}
                    onChangeText={v =>
                      updateVariantFieldWithPreview(
                        'quantityAvailable',
                        Number(v) || 0,
                      )
                    }
                  />
                </View>
              </View>

              {/* PRICING SECTION - With formatted price display */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Pricing</Text>
                <View style={styles.pricingNoteBox}>
                  <Icon name="info" size={16} color="#3b82f6" />
                  <Text style={styles.pricingNoteText}>
                    Discount, Saved Amount & Final Price will be auto-calculated
                    by the system
                  </Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.inputLabel}>
                      MRP <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter MRP"
                      keyboardType="numeric"
                      value={String(currentVariant.mrp)}
                      onChangeText={v =>
                        updateVariantFieldWithPreview('mrp', Number(v) || 0)
                      }
                    />
                    {currentVariant.mrp > 0 && (
                      <Text style={styles.formattedPriceHint}>
                        ₹{formatPrice(currentVariant.mrp)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.inputLabel}>
                      Base Price <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Base Price"
                      keyboardType="numeric"
                      value={String(currentVariant.price)}
                      onChangeText={v =>
                        updateVariantFieldWithPreview('price', Number(v) || 0)
                      }
                    />
                    {currentVariant.price > 0 && (
                      <Text style={styles.formattedPriceHint}>
                        ₹{formatPrice(currentVariant.price)}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.inputLabel}>Discount (%)</Text>
                    <View style={styles.disabledInputWrapper}>
                      <Text style={styles.disabledInputText}>
                        {currentVariant.discount > 0
                          ? `${currentVariant.discount}%`
                          : 'Auto-calculated'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.inputLabel}>Saved Amount</Text>
                    <View style={styles.disabledInputWrapper}>
                      <Text style={styles.disabledInputText}>
                        {currentVariant.savedAmount > 0
                          ? `₹${formatPrice(currentVariant.savedAmount)}`
                          : 'Auto-calculated'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.inputLabel}>Final Price</Text>
                    <View style={styles.disabledInputWrapper}>
                      <Text style={styles.disabledInputText}>
                        {currentVariant.finalPrice > 0
                          ? `₹${formatPrice(currentVariant.finalPrice)}`
                          : 'Auto-calculated'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Offer Text (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Bank Offer, Festival Sale"
                  value={currentVariant.offerText}
                  onChangeText={v =>
                    setCurrentVariant(p => ({ ...p, offerText: v }))
                  }
                />
              </View>

              {/* Images Section */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>
                  Images <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={handleVariantImageSelect}
                >
                  <Icon name="add-a-photo" size={20} color="#fff" />
                  <Text style={styles.mediaBtnText}>Select Images</Text>
                </TouchableOpacity>

                {(currentVariant.localImages.length > 0 ||
                  currentVariant.images.length > 0) && (
                  <ScrollView horizontal style={styles.imageScroll}>
                    {currentVariant.localImages.map((uri, i) => (
                      <View key={i} style={styles.imageBox}>
                        <Image source={{ uri }} style={styles.image} />
                        <TouchableOpacity
                          style={styles.imageRemove}
                          onPress={() => removeVariantImage(i)}
                        >
                          <Icon name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      </View>
                    ))}
                    {currentVariant.images.map((url, i) => (
                      <View key={`uploaded_${i}`} style={styles.imageBox}>
                        <Image source={{ uri: url }} style={styles.image} />
                        <View style={styles.uploadedBadge}>
                          <Icon name="check" size={10} color="#fff" />
                          <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Video Section with Thumbnail */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Video (Optional)</Text>
                <TouchableOpacity
                  style={[styles.mediaBtn, { backgroundColor: '#ef4444' }]}
                  onPress={handleVariantVideoSelect}
                >
                  <Icon name="videocam" size={20} color="#fff" />
                  <Text style={styles.mediaBtnText}>
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

              {/* ✅ FIX: Shipping dimensions with direct setState to avoid price recalculation */}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Weight"
                    keyboardType="numeric"
                    value={currentVariant.weight}
                    onChangeText={v =>
                      setCurrentVariant(prev => ({ ...prev, weight: v }))
                    }
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>Dimensions (cm)</Text>
              <View style={styles.dimRow}>
                <TextInput
                  style={styles.dimInput}
                  placeholder="H"
                  keyboardType="numeric"
                  value={currentVariant.height}
                  onChangeText={v =>
                    setCurrentVariant(prev => ({ ...prev, height: v }))
                  }
                />
                <TextInput
                  style={styles.dimInput}
                  placeholder="W"
                  keyboardType="numeric"
                  value={currentVariant.width}
                  onChangeText={v =>
                    setCurrentVariant(prev => ({ ...prev, width: v }))
                  }
                />
                <TextInput
                  style={styles.dimInput}
                  placeholder="L"
                  keyboardType="numeric"
                  value={currentVariant.length}
                  onChangeText={v =>
                    setCurrentVariant(prev => ({ ...prev, length: v }))
                  }
                />
              </View>

              {/* Status Toggles */}
              <View style={styles.variantToggleSection}>
                <Text style={styles.modalSectionTitle}>Variant Status</Text>
                <CustomToggle
                  label="In Stock"
                  icon="inventory"
                  value={currentVariant.inStock}
                  onValueChange={v =>
                    updateVariantFieldWithPreview('inStock', v)
                  }
                  description="Product available for sale"
                />
                <CustomToggle
                  label="Default Variant"
                  icon="star"
                  value={currentVariant.isDefault}
                  onValueChange={v =>
                    updateVariantFieldWithPreview('isDefault', v)
                  }
                  description="This variant will be shown first"
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={saveVariant}>
                <Icon name="check-circle" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {editingVariantIndex !== null
                    ? 'Update Variant'
                    : 'Save Variant'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <UploadProgressModal
        visible={uploading}
        progress={uploadProgress}
        isTakingLong={isTakingLong}
      />
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
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
  variantMediaCount: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  variantListPriceNote: {
    fontSize: 10,
    color: '#3b82f6',
    marginTop: 2,
    fontStyle: 'italic',
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
  customToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  customToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  customToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customToggleLabel: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  customToggleDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  customToggleSwitch: { marginLeft: 12 },
  customToggleTrack: { width: 52, height: 28, borderRadius: 14, padding: 2 },
  customToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
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
  videoPreviewContainer: {
    marginTop: 12,
  },
  videoPreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoThumbnailWrapper: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
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
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  videoPlayerWrapper: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
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
  videoRemoveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
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
  videoUploadedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  videoPendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoPendingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
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
  fullScreenUploadOverlay: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenUploadCard: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  uploadLottie: { width: 150, height: 150, marginBottom: 20 },
  fullScreenUploadTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 8,
  },
  fullScreenUploadText: { fontSize: 16, color: '#94a3b8', marginBottom: 24 },
  fullScreenProgressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  fullScreenProgressFill: { height: '100%', borderRadius: 4 },
  fullScreenUploadPercent: { fontSize: 32, fontWeight: '800', marginTop: 16 },
  takingLongText: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default ProductForm;
