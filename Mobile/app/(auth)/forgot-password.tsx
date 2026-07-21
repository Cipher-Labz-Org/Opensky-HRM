import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Field } from "@/components/ui";
import {
  AuthFormCard,
  AuthPrimaryButton,
  AuthScreen,
  AuthTextLink,
} from "@/features/auth";
import { forgotPasswordReset, forgotPasswordVerify } from "@/api/endpoints/auth";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<"verify" | "reset">("verify");
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (!employeeCode.trim() || !employeeName.trim()) {
      Alert.alert("Required fields", "Enter your employee code and full name.");
      return;
    }
    setLoading(true);
    try {
      const response = await forgotPasswordVerify({
        employeeCode: employeeCode.trim(),
        employeeName: employeeName.trim(),
      });
      setResetToken(response.resetToken);
      setStep("reset");
    } catch (error) {
      Alert.alert("Verification failed", error instanceof Error ? error.message : "Could not verify identity.");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await forgotPasswordReset({ resetToken, newPassword });
      Alert.alert("Password reset", "You can now sign in with your new password.");
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Reset failed", error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      eyebrow="Account recovery"
      title="Forgot password"
      subtitle="Verify your identity using employee details"
    >
      <AuthFormCard
        title={step === "verify" ? "Verify identity" : "Set new password"}
        icon={step === "verify" ? "person-outline" : "key-outline"}
      >
        {step === "verify" ? (
          <>
            <Field
              label="Employee code"
              autoCapitalize="characters"
              value={employeeCode}
              onChangeText={setEmployeeCode}
            />
            <Field label="Full name" value={employeeName} onChangeText={setEmployeeName} />
            <AuthPrimaryButton title="Verify" loading={loading} onPress={() => void onVerify()} />
          </>
        ) : (
          <>
            <Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <Field
              label="Confirm password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <AuthPrimaryButton
              title="Reset password"
              icon="checkmark-circle-outline"
              loading={loading}
              onPress={() => void onReset()}
            />
          </>
        )}

        <AuthTextLink title="Back to sign in" onPress={() => router.replace("/(auth)/login")} />
      </AuthFormCard>
    </AuthScreen>
  );
}
