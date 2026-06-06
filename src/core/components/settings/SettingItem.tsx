// components/SettingsItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SettingsItem as SettingsItemType } from '../../types/settings';

interface SettingsItemProps {
  item: SettingsItemType;
  onItemPress: (segment: string) => void;
  level?: number;
  isDark?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({ 
  item, 
  onItemPress, 
  level = 0,
  isDark = false
}) => {
  // Custom Divider component to replace react-native-paper Divider
  const Divider = () => (
    <View style={[styles.divider, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
  );

  if (item.kind === 'divider') {
    return <Divider />;
  }

  if (item.kind === 'header') {
    return (
      <View style={styles.headerContainer}>
        <Text style={[styles.headerText, { color: isDark ? '#94A3B8' : '#475569' }]}>
          {item.title}
        </Text>
      </View>
    );
  }

  const paddingLeft = 20 + (level * 20);

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.itemContainer, 
          { 
            paddingLeft,
            backgroundColor: isDark ? '#1E293B' : 'white',
          }
        ]}
        onPress={() => {
          if (item.onPress) {
            item.onPress();
          } else if (item.segment) {
            onItemPress(item.segment);
          }
        }}
        disabled={!item.segment && !item.onPress}
      >
        <View style={[
          styles.iconContainer, 
          { backgroundColor: isDark ? '#334155' : '#F1F5F9' }
        ]}>
          {item.icon}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[
            styles.title, 
            { color: isDark ? '#F1F5F9' : '#1E293B' }
          ]}>
            {item.title}
          </Text>
          {item.value && (
            <Text style={[
              styles.value, 
              { color: isDark ? '#94A3B8' : '#64748B' }
            ]}>
              {item.value}
            </Text>
          )}
        </View>

        {item.rightElement ? (
          item.rightElement
        ) : (
          item.children && item.children.length > 0 && (
            <Icon 
              name="keyboard-arrow-right" 
              size={24} 
              color={isDark ? '#94A3B8' : '#666'} 
            />
          )
        )}
      </TouchableOpacity>
      
      {item.children?.map((child, index) => (
        <SettingsItem 
          key={index} 
          item={child} 
          onItemPress={onItemPress}
          level={level + 1}
          isDark={isDark}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
  },
  divider: {
    marginVertical: 12,
    height: 1,
  },
  headerContainer: {
    padding: 20,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});