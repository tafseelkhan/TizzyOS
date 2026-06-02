// screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import LottieView from "lottie-react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import FA5Icon from "react-native-vector-icons/FontAwesome5";
import FAIcon from "react-native-vector-icons/FontAwesome";
import IIcon from "react-native-vector-icons/Ionicons";
import BottomNavigation from '../home/BottomNavigation';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../contexts/theme/ThemeContext";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BASE_URL = "http://172.20.10.12:5000";

interface ProfileData {
  _id: string;
  name: string;
  image: string;
  email: string;
  phone: string;
  joinDate: string;
  verified: boolean;
}

export default function ProfileScreen() {
  const [previewImage, setPreviewImage] = useState("");
  const { isDark, resolvedTheme } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState<boolean>(true);
  const [hasImage, setHasImage] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    _id: "",
    name: "",
    image: "",
    email: "",
    phone: "",
    joinDate: "",
    verified: false,
  });

  const getImageUrl = (image?: string): string => {
    if (!image) return "";
    if (image.startsWith("http")) return image;
    // If it's a relative path, construct full URL
    if (image.startsWith("/")) {
      return `${BASE_URL}${image}`;
    }
    return "";
  };

  // Dynamic colors based on theme
  const backgroundColor = isDark ? '#1E293B' : '#f9fafb';
  const textColor = isDark ? '#F1F5F9' : '#1a1a1a';
  const subtitleColor = isDark ? '#94A3B8' : '#6b7280';
  const cardBackground = isDark ? '#1E293B' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const contactBackground = isDark ? '#374151' : '#f3f4f6';
  const statusBackground = isDark ? '#374151' : '#f3f4f6';

  // Fixed gradient colors
  const gradientColors: string[] = isDark 
    ? ["#1E293B", "#1E293B", "#1E293B"] 
    : ["#f9fafb", "#f9fafb", "#f9fafb"];
  
  const buttonGradient: string[] = isDark 
    ? ["#7C3AED", "#6D28D9"] 
    : ["#8b5cf6", "#3b82f6"];
  
  const secondaryButtonGradient: string[] = isDark 
    ? ["#475569", "#374151"] 
    : ["#6b7280", "#374151"];
  
  const statCardBackground = isDark ? '#374151' : '#ffffff';
  const statCardBorder = isDark ? '#475569' : '#e5e7eb';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("authToken");

        const response = await fetch(
          `${BASE_URL}/api/profile/me`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok) {
          let imageUrl = "";
          let hasValidImage = false;
          
          // Check if image exists and is valid
          if (data?.image && data.image !== "" && data.image !== "null" && data.image !== "undefined") {
            imageUrl = getImageUrl(data.image);
            // Validate if it's a proper URL
            hasValidImage = imageUrl.startsWith("http") && imageUrl.length > 10;
            
            console.log("Profile image data:", {
              original: data.image,
              processed: imageUrl,
              isValid: hasValidImage
            });
          }

          setProfileData({
            _id: data?._id ?? "",
            name: data?.name ?? "User",
            email: data?.email ?? "Not provided",
            phone: data?.phone ?? "Not provided",
            joinDate: data?.joinDate ?? new Date().toLocaleDateString(),
            verified: data?.verified ?? false,
            image: hasValidImage ? imageUrl : "",
          });

          setHasImage(hasValidImage);
          setPreviewImage(hasValidImage ? imageUrl : "");
        } else {
          console.error(
            "Error fetching profile:",
            data?.message ?? "Unknown error"
          );
          Alert.alert("Error", "Failed to load profile data");
          setHasImage(false);
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        Alert.alert("Error", "Network error occurred");
        setHasImage(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Settings button press handler
  const handleSettingsPress = () => {
    navigation.navigate("Settings" as never)
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.loadingCard, { 
          backgroundColor: cardBackground,
          borderColor: cardBorder 
        }]}>
          <ActivityIndicator size="large" color={isDark ? "#A78BFA" : "#8b5cf6"} />
          <Text style={[styles.loadingText, { color: subtitleColor }]}>
            Loading your profile...
          </Text>
        </View>
      </View>
    );
  }

  console.log("Rendering condition:", {
    hasImage: hasImage,
    imageValue: profileData.image,
    shouldShowImage: hasImage && profileData.image !== ""
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar 
        backgroundColor={isDark ? "#1E293B" : "#f9fafb"} 
        barStyle={isDark ? "light-content" : "dark-content"} 
      />

      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Content with Fixed Bottom Navigation */}
      <View style={styles.mainContent}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header with Settings Button */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.userName, { color: textColor }]}>
                {profileData.name}
              </Text>
              {/* Settings Button */}
              <TouchableOpacity 
                style={[styles.settingsButton, { 
                  backgroundColor: isDark ? '#374151' : '#e5e7eb' 
                }]}
                onPress={handleSettingsPress}
              >
                <IIcon 
                  name="settings" 
                  size={30} 
                  color={isDark ? "#F1F5F9" : "#4b5563"} 
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>
              Manage your personal information
            </Text>
          </View>

          {/* Main Profile Card */}
          <View style={[styles.profileCard, { 
            backgroundColor: cardBackground,
            borderColor: cardBorder 
          }]}>
            {/* Profile Image */}
            <View style={styles.imageSection}>
              <View style={styles.imageContainer}>
                <View style={[
                  styles.imageWrapper, 
                  { 
                    borderColor: isDark ? '#00000000' : '#00000000',
                    backgroundColor: isDark ? '#00000000' : '#00000000'
                  }
                ]}>
                  {/* Conditional rendering: Show user image if available, otherwise show Lottie animation */}
                  {hasImage && profileData.image && profileData.image !== "" ? (
                    <Image
                      source={{ uri: profileData.image }}
                      style={styles.profileImage}
                      resizeMode="cover"
                      onError={(e) => {
                        console.log("Image load error:", e.nativeEvent.error);
                        setHasImage(false); // Fallback to Lottie if image fails to load
                      }}
                    />
                  ) : (
                    <LottieView
                      source={require("../../../core/components/animations/lotties/Login icon (1).json")}
                      style={styles.profileImage}
                      autoPlay={true}
                      loop={true}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {/* Verified Badge */}
                {profileData.verified && (
                  <View style={styles.verifiedBadge}>
                    <FAIcon name="check" size={10} color="white" />
                  </View>
                )}
              </View>
            </View>

            {/* Contact Info */}
            <View style={styles.contactSection}>
              {/* Email Field */}
              {profileData.email !== "Not provided" && (
                <View style={[styles.contactItem, { backgroundColor: contactBackground }]}>
                  <View
                    style={[
                      styles.contactIcon,
                      { backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)" },
                    ]}
                  >
                    <Icon name="email" size={16} color="#ef4444" />
                  </View>
                  <View style={styles.contactContent}>
                    <Text style={[styles.contactLabel, { color: subtitleColor }]}>
                      Email
                    </Text>
                    <Text style={[styles.contactValue, { color: textColor }]}>
                      {profileData.email}
                    </Text>
                  </View>
                </View>
              )}

              {/* Phone Field */}
              {profileData.phone !== "Not provided" && (
                <View style={[styles.contactItem, { backgroundColor: contactBackground }]}>
                  <View
                    style={[
                      styles.contactIcon,
                      { backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.1)" },
                    ]}
                  >
                    <FA5Icon name="phone" size={12} color="#10b981" />
                  </View>
                  <View style={styles.contactContent}>
                    <Text style={[styles.contactLabel, { color: subtitleColor }]}>
                      Phone
                    </Text>
                    <Text style={[styles.contactValue, { color: textColor }]}>
                      {profileData.phone}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Account Status */}
            <View style={styles.accountStatus}>
              <View style={[styles.statusItem, { backgroundColor: statusBackground }]}>
                <View style={[
                  styles.statusIcon, 
                  { backgroundColor: isDark ? "#D97706" : "#f59e0b" }
                ]}>
                  <Icon name="security" size={16} color="white" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { color: subtitleColor }]}>
                    Account Status
                  </Text>
                  <View style={styles.statusContainer}>
                    <Text style={[styles.statusValue, { color: textColor }]}>
                      {profileData.verified ? "Verified" : "Not Verified"}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        profileData.verified
                          ? styles.verifiedStatus
                          : styles.pendingStatus,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {profileData.verified ? "Secure" : "Pending"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("EditProfile" as never)}
            >
              <LinearGradient
                colors={buttonGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Icon name="edit" size={18} color="white" />
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("Security" as never)}
            >
              <LinearGradient
                colors={secondaryButtonGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Icon name="security" size={18} color="white" />
              <Text style={styles.buttonText}>Security</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { 
              backgroundColor: statCardBackground,
              borderColor: statCardBorder 
            }]}>
              <Text style={[styles.statNumber, { color: isDark ? "#A78BFA" : "#8b5cf6" }]}>
                0
              </Text>
              <Text style={[styles.statLabel, { color: subtitleColor }]}>
                Orders
              </Text>
            </View>

            <View style={[styles.statCard, { 
              backgroundColor: statCardBackground,
              borderColor: statCardBorder 
            }]}>
              <Text style={[styles.statNumber, { color: isDark ? "#60A5FA" : "#3b82f6" }]}>
                0
              </Text>
              <Text style={[styles.statLabel, { color: subtitleColor }]}>
                Reviews
              </Text>
            </View>

            <View style={[styles.statCard, { 
              backgroundColor: statCardBackground,
              borderColor: statCardBorder 
            }]}>
              <Text style={[styles.statNumber, { color: isDark ? "#34D399" : "#10b981" }]}>
                0
              </Text>
              <Text style={[styles.statLabel, { color: subtitleColor }]}>
                Likes
              </Text>
            </View>
          </View>

          {/* Bottom Spacer for Navigation */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>

      {/* Fixed Bottom Navigation */}
      <View style={styles.bottomNavContainer}>
        <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    marginBottom: 60,
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: screenHeight * 0.06,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 24,
    marginTop: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    fontSize: screenWidth * 0.09,
    fontWeight: "bold",
    textAlign: "left",
    flex: 1,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerSubtitle: {
    fontSize: screenWidth * 0.038,
    textAlign: "left",
  },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
  },
  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrapper: {
    width: screenWidth * 0.25,
    height: screenWidth * 0.25,
    borderRadius: (screenWidth * 0.25) / 2,
    borderWidth: 3,
    overflow: "hidden",
    shadowColor: "#00000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#10b981",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  contactSection: {
    gap: 12,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: screenWidth * 0.032,
    fontWeight: "600",
    marginBottom: 2,
  },
  contactValue: {
    fontSize: screenWidth * 0.035,
    fontWeight: "bold",
  },
  accountStatus: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 16,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: screenWidth * 0.035,
    fontWeight: "600",
    marginBottom: 2,
  },
  statusValue: {
    fontSize: screenWidth * 0.038,
    fontWeight: "bold",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedStatus: {
    backgroundColor: "#dcfce7",
  },
  pendingStatus: {
    backgroundColor: "#fef3c7",
  },
  statusText: {
    fontSize: screenWidth * 0.028,
    fontWeight: "600",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: screenWidth * 0.038,
    fontWeight: "600",
    color: "white",
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: screenWidth * 0.055,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: screenWidth * 0.03,
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 12,
    fontSize: screenWidth * 0.04,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 20,
  },
});