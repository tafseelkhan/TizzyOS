// utils/imageUtils.ts
import { getImageUrl } from './profileUtils';

export const processProfileImage = (image: string | undefined) => {
  let imageUrl = "";
  let hasValidImage = false;
  
  if (image && image !== "" && image !== "null" && image !== "undefined") {
    imageUrl = getImageUrl(image);
    hasValidImage = imageUrl.startsWith("http") && imageUrl.length > 10;
  }
  
  return {
    url: hasValidImage ? imageUrl : "",
    hasValidImage
  };
};

export const getBase64SizeInMB = (base64String: string): number => {
  return (base64String.length * 3) / (4 * 1024 * 1024);
};