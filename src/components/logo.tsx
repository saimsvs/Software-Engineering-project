import { Image } from "react-native";

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={require("@/assets/images/logo.png")}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="contain"
    />
  );
}
