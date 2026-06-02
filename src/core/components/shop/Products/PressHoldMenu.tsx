import React from 'react';
import {
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

interface PressMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  menuWidth?: number;
  menuHeight?: number;
  offsetX?: number;
  offsetY?: number;
}

const PressMenu: React.FC<PressMenuProps> = ({
  visible,
  position,
  onEdit,
  onDelete,
  onClose,
  menuWidth = 120,
  menuHeight = 90,
  offsetX = 10,
  offsetY = 10,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Calculate position with offset
  let adjustedX = position.x + offsetX;
  let adjustedY = position.y + offsetY;
  
  // Adjust position to keep menu within screen bounds
  if (adjustedX + menuWidth > screenWidth) {
    adjustedX = screenWidth - menuWidth - 20;
  }
  
  if (adjustedY + menuHeight > screenHeight) {
    adjustedY = screenHeight - menuHeight - 20;
  }

  if (adjustedX < 0) {
    adjustedX = 20;
  }

  if (adjustedY < 0) {
    adjustedY = 20;
  }

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View 
            style={[
              styles.menuContainer,
              {
                top: adjustedY,
                left: adjustedX,
                width: menuWidth,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Text style={styles.menuText}>✏️ Edit</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity 
              style={[styles.menuItem, styles.deleteItem]}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuText, styles.deleteText]}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteItem: {
    borderTopWidth: 0,
  },
  menuText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '500',
      },
      android: {
        fontFamily: 'Roboto',
        fontWeight: '500',
      },
    }),
  },
  deleteText: {
    color: '#e53935',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
});

export default PressMenu;