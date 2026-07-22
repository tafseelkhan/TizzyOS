// utils/profileUtils.ts
export const getImageUrl = (image?: string): string => {
  if (!image) return "";
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) {
    return `http://172.20.245.121:5000${image}`;
  }
  return "";
};

export const validateProfileForm = (formData: any) => {
  const errors: string[] = [];
  
  if (!formData.name.trim()) {
    errors.push("Name is required");
  }
  
  if (!formData.email.trim()) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.push("Please enter a valid email address");
  }
  
  if (!formData.phone.trim()) {
    errors.push("Phone number is required");
  } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
    errors.push("Please enter a valid 10-digit phone number");
  }
  
  return errors;
};