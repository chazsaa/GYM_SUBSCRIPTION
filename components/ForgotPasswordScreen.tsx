import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendResetLink = () => {
    if (!email.trim()) {
      setEmailError('Enter your email to continue.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError('');
    console.log('Send reset link pressed:', { email });
    setIsSubmitted(true);
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge} />
            <Text style={styles.logoText}>GymFit</Text>
          </View>

          {!isSubmitted ? (
            <>
              <Text style={styles.welcomeTitle}>Forgot Password</Text>
              <Text style={styles.subtitle}>
                Enter the email linked to your account and we&apos;ll send you a link to reset your password.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, !!emailError && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#8A8A8A"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (emailError) setEmailError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleSendResetLink}
              >
                <Text style={styles.primaryButtonText}>SEND RESET LINK</Text>
              </TouchableOpacity>

              <View style={styles.bottomLinkContainer}>
                <Text style={styles.bottomLinkText}>Remembered your password? </Text>
                <TouchableOpacity onPress={handleBackToLogin}>
                  <Text style={styles.bottomLinkAction}>Login</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.welcomeTitle}>Check Your Email</Text>
              <Text style={styles.subtitle}>
                If an account exists for{' '}
                <Text style={styles.emailHighlight}>{email}</Text>, a reset link is on
                its way. It expires in 30 minutes.
              </Text>

              <View style={styles.bottomLinkContainer}>
                <Text style={styles.bottomLinkText}>Back to </Text>
                <TouchableOpacity onPress={handleBackToLogin}>
                  <Text style={styles.bottomLinkAction}>Login</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const COLORS = {
  background: '#0D0D0D',
  cardBackground: '#1A1A1A',
  maroon: '#8B0000',
  darkRed: '#B22222',
  textLight: '#F5F5F5',
  textMuted: '#A0A0A0',
  border: '#2A2A2A',
  error: '#FF6B6B',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.maroon,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 36,
    lineHeight: 20,
  },
  emailHighlight: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textLight,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12.5,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.maroon,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  bottomLinkText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  bottomLinkAction: {
    color: COLORS.darkRed,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ForgotPasswordScreen;