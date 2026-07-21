import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Field } from "@/components/ui";
import { AuthFormCard, AuthPrimaryButton, AuthScreen } from "@/features/auth";
import { changePassword } from "@/api/endpoints/auth";
import { useAuthStore } from "@/store/authStore";

export default function ChangePasswordScreen() {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Required fields", "Enter your current and new password.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Weak password", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      await refreshProfile();
      Alert.alert("Password updated", "Your password has been changed.");
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      eyebrow="Security"
      title="Change password"
      subtitle={
        mustChangePassword
          ? "You must change your password before continuing"
          : "Keep your account secure with a strong password"
      }
    >
      <AuthFormCard title="Update credentials" icon="lock-closed-outline">
        <Field
          label="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <Field
          label="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <AuthPrimaryButton
          title="Update password"
          icon="shield-checkmark-outline"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </AuthFormCard>
    </AuthScreen>
  );
}
