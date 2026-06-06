import react from "react";
import ApplySection from "../../core/components/shipping/Apply/Register";
import { useNavigation } from "@react-navigation/native";

export default function RegisterScreen() {
    const navigation = useNavigation();
    return <ApplySection />;
}
