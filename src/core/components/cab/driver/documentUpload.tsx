// src/components/cab/DocumentUpload.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ImageResult } from '../../../services/cab/cabService';

const { width } = Dimensions.get('window');

interface DocumentUploadProps {
  label: string;
  image: ImageResult | null;
  onPress: () => void;
  optional?: boolean;
  error?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  label,
  image,
  onPress,
  optional = false,
  error,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {optional && (
          <View style={styles.optionalBadge}>
            <Text style={styles.optionalBadgeText}>Optional</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.uploadBox,
          image && styles.uploadBoxWithImage,
          error && styles.uploadBoxError,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {image ? (
          <>
            <Image source={{ uri: image.uri }} style={styles.previewImage} />
            <View style={styles.imageOverlay}>
              <View style={styles.imageBadge}>
                <Icon name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.imageBadgeText}>Uploaded</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <View style={styles.iconContainer}>
              <Icon name="cloud-upload-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.uploadTitle}>Tap to Upload</Text>
            <Text style={styles.uploadSubtitle}>
              {optional ? 'Optional document' : 'Required document'}
            </Text>
            <View style={styles.formatContainer}>
              <View style={styles.formatBadge}>
                <Icon name="image-outline" size={10} color="#6B7280" />
                <Text style={styles.formatText}>JPG</Text>
              </View>
              <View style={styles.formatBadge}>
                <Icon name="image-outline" size={10} color="#6B7280" />
                <Text style={styles.formatText}>PNG</Text>
              </View>
              <View style={styles.formatBadge}>
                <Icon name="document-outline" size={10} color="#6B7280" />
                <Text style={styles.formatText}>PDF</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={13} color="#EF4444" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {image && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={onPress}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Icon name="refresh-outline" size={13} color="#3B82F6" />
            <Text style={styles.actionText}>Re-upload</Text>
          </TouchableOpacity>
          <View style={styles.fileInfo}>
            <Icon name="document-outline" size={11} color="#9CA3AF" />
            <Text style={styles.fileName} numberOfLines={1}>
              {image.fileName || 'document.jpg'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  optionalBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionalBadgeText: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  uploadBox: {
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    width: '100%',
  },
  uploadBoxWithImage: {
    borderStyle: 'solid',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  uploadBoxError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '300',
    color: '#1A1A1A',
    marginBottom: 2,
    textAlign: 'center',
  },
  uploadSubtitle: {
    fontSize: 11,
    fontFamily: 'Poppins-LightItalic',
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  formatContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  formatText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
    marginLeft: 3,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 8,
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  imageBadgeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
    marginLeft: 4,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  fileName: {
    fontSize: 10,
    color: '#6B7280',
    maxWidth: 100,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginLeft: 4,
    flex: 1,
  },
});

export default DocumentUpload;
